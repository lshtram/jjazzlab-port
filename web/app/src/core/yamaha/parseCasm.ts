export type Ctb2Settings = {
  ntr: number;
  ntt: number;
  bassOn: boolean;
  chordRootUpper: number;
  noteLow: number;
  noteHigh: number;
  rtr: number;
};

type SffType = 'SFF1' | 'SFF2' | null;

export type CasmInfo = {
  channelMap: Map<number, number>;
  sourceChordByChannel: Map<number, number>;
  sourceChordTypeByChannel: Map<number, string>;
  ctb2ByChannel: Map<number, Ctb2Settings>;
  cnttByChannel: Map<number, { ntt: number; bassOn: boolean }>;
};

export type CasmByPart = Map<string, CasmInfo>;

class Reader {
  private offset = 0;
  private readonly view: DataView;
  private readonly buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  readString(length: number): string {
    const end = this.offset + length;
    let value = '';
    for (let i = this.offset; i < end; i += 1) {
      value += String.fromCharCode(this.buffer[i] ?? 0);
    }
    this.offset = end;
    return value;
  }

  readUInt8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt32(): number {
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  skip(length: number): void {
    this.offset = Math.min(this.buffer.length, this.offset + length);
  }
}

function indexOfAscii(buffer: Uint8Array, text: string): number {
  if (!text) {
    return -1;
  }
  const codes = Array.from(text, (char) => char.charCodeAt(0) & 0xff);
  const maxIndex = buffer.length - codes.length;
  for (let i = 0; i <= maxIndex; i += 1) {
    let matches = true;
    for (let j = 0; j < codes.length; j += 1) {
      if (buffer[i + j] !== codes[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }
  return -1;
}

const yamChordNames = [
  '1+2+5',
  'sus4',
  '1+5',
  '1+8',
  '7aug',
  'Maj7aug',
  '7(#9)',
  '7(b13)',
  '7(b9)',
  '7(13)',
  '7#11',
  '7(9)',
  '7b5',
  '7sus4',
  '7th',
  'dim7',
  'dim',
  'minMaj7(9)',
  'minMaj7',
  'min7(11)',
  'min7(9)',
  'min(9)',
  'm7b5',
  'min7',
  'min6',
  'min',
  'aug',
  'Maj6(9)',
  'Maj7(9)',
  'Maj(9)',
  'Maj7#11',
  'Maj7',
  'Maj6',
  'Maj',
];

function mapSourceChordType(code: number): string | null {
  if (code > 0x22) {
    return null;
  }
  const index = code === 0x22 ? 2 : 0x21 - code;
  return yamChordNames[index] ?? null;
}

function adaptNttForSff1(raw: number, bassOn: boolean): { ntt: number; bassOn: boolean } {
  if (raw === 3) {
    return { ntt: 1, bassOn: true };
  }
  if (raw === 4) {
    return { ntt: 3, bassOn };
  }
  return { ntt: raw, bassOn };
}

function readCtb2Subpart(reader: Reader, sffType: SffType): Ctb2Settings {
  const ntr = reader.readUInt8();
  const nttByte = reader.readUInt8();
  const bassOn = (nttByte & 0x80) === 0x80;
  let ntt = nttByte & 0x7f;
  let finalBassOn = bassOn;
  if (ntr !== 2 && sffType === 'SFF1') {
    const adapted = adaptNttForSff1(ntt, bassOn);
    ntt = adapted.ntt;
    finalBassOn = adapted.bassOn;
  }
  const chordRootUpper = reader.readUInt8();
  const noteLow = reader.readUInt8();
  const noteHigh = reader.readUInt8();
  const rtr = reader.readUInt8();
  return {
    ntr,
    ntt,
    bassOn: finalBassOn,
    chordRootUpper,
    noteLow,
    noteHigh,
    rtr,
  };
}

function parseCtabSection(data: Uint8Array, info: CasmInfo, isCtb2: boolean, sffType: SffType): void {
  const reader = new Reader(data);
  if (reader.remaining() < 20) {
    return;
  }

  const srcChannel = reader.readUInt8();
  reader.skip(8); // name
  const destChannel = reader.readUInt8();
  reader.skip(1); // editable
  reader.skip(2); // muted notes
  reader.skip(5); // muted chords
  const sourceChordNote = reader.readUInt8();
  const sourceChordType = reader.readUInt8();
  const chordName = mapSourceChordType(sourceChordType);

  info.channelMap.set(srcChannel, destChannel);
  info.sourceChordByChannel.set(srcChannel, sourceChordNote);
  if (chordName) {
    info.sourceChordTypeByChannel.set(srcChannel, chordName);
  }

  if (isCtb2) {
    reader.skip(2); // middle low/high
    reader.skip(6); // low
    const main = readCtb2Subpart(reader, sffType);
    info.ctb2ByChannel.set(srcChannel, main);
    reader.skip(6); // high
    reader.skip(7); // trailing unknown bytes
  } else {
    const main = readCtb2Subpart(reader, sffType);
    info.ctb2ByChannel.set(srcChannel, main);
    const specialFeature = reader.readUInt8();
    if (specialFeature !== 0) {
      reader.skip(4);
    }
  }
}

function normalizePartName(value: string): string {
  return value.trim().replace(/\s+/g, '_').toLowerCase();
}

function createCasmInfo(): CasmInfo {
  return {
    channelMap: new Map(),
    sourceChordByChannel: new Map(),
    sourceChordTypeByChannel: new Map(),
    ctb2ByChannel: new Map(),
    cnttByChannel: new Map(),
  };
}

function getCasmInfosForParts(infoByPart: CasmByPart, partNames: string[]): CasmInfo[] {
  const infos: CasmInfo[] = [];
  for (const name of partNames) {
    const id = normalizePartName(name);
    if (!id) {
      continue;
    }
    let info = infoByPart.get(id);
    if (!info) {
      info = createCasmInfo();
      infoByPart.set(id, info);
    }
    infos.push(info);
  }
  return infos;
}

function parseCsegSection(data: Uint8Array, infoByPart: CasmByPart, sffType: SffType): void {
  const reader = new Reader(data);
  if (reader.remaining() < 8) {
    return;
  }

  const header = reader.readString(4);
  if (header !== 'Sdec') {
    return;
  }

  const sdecSize = reader.readUInt32();
  const sdecData = reader.readBytes(sdecSize);
  const sdecText = Array.from(sdecData, (byte) => String.fromCharCode(byte))
    .join('')
    .replace(/\0/g, '');
  const partNames = sdecText.split(',').map((entry) => entry.trim()).filter(Boolean);
  const infos = getCasmInfosForParts(infoByPart, partNames);
  if (infos.length === 0) {
    return;
  }

  while (reader.remaining() >= 8) {
    const sectionName = reader.readString(4);
    const sectionSize = reader.readUInt32();
    if (sectionSize > reader.remaining()) {
      reader.skip(reader.remaining());
      break;
    }
    const section = reader.readBytes(sectionSize);
    if (sectionName === 'Ctab') {
      for (const info of infos) {
        parseCtabSection(section, info, false, sffType);
      }
    } else if (sectionName === 'Ctb2') {
      for (const info of infos) {
        parseCtabSection(section, info, true, sffType);
      }
    } else if (sectionName === 'Cntt') {
      for (const info of infos) {
        parseCnttSection(section, info);
      }
    }
  }
}

function parseCnttSection(data: Uint8Array, info: CasmInfo): void {
  if (data.length < 2) {
    return;
  }
  const reader = new Reader(data);
  const channel = reader.readUInt8();
  const nttByte = reader.readUInt8();
  const bassOn = (nttByte & 0x80) === 0x80;
  const ntt = nttByte & 0x7f;
  info.cnttByChannel.set(channel, { ntt, bassOn });
}

export function parseCasmFromBuffer(buffer: Uint8Array, sffType: SffType): CasmByPart | null {
  const casmIndex = indexOfAscii(buffer, 'CASM');
  if (casmIndex === -1) {
    return null;
  }

  if (casmIndex + 8 >= buffer.length) {
    return null;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const casmSize = view.getUint32(casmIndex + 4, false);
  const casmStart = casmIndex + 8;
  const casmEnd = Math.min(buffer.length, casmStart + casmSize);
  const casmData = buffer.subarray(casmStart, casmEnd);
  const reader = new Reader(casmData);

  const infoByPart: CasmByPart = new Map();

  while (reader.remaining() >= 8) {
    const sectionName = reader.readString(4);
    const sectionSize = reader.readUInt32();
    if (sectionSize > reader.remaining()) {
      break;
    }
    const section = reader.readBytes(sectionSize);
    if (sectionName === 'CSEG') {
      parseCsegSection(section, infoByPart, sffType);
    }
  }

  for (const info of infoByPart.values()) {
    for (const [channel, cntt] of info.cnttByChannel.entries()) {
      const ctb2 = info.ctb2ByChannel.get(channel);
      if (!ctb2) {
        continue;
      }
      ctb2.ntt = cntt.ntt;
      ctb2.bassOn = cntt.bassOn;
    }
  }

  return infoByPart;
}
