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
  mutedNotesByChannel: Map<number, Set<number>>;
  mutedChordsByChannel: Map<number, Set<string>>;
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

const yamChordOrder = yamChordNames.slice();

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

function parseMutedNotes(b1: number, b2: number): Set<number> {
  const muted = new Set<number>();
  if ((b1 & 8) === 0) muted.add(11);
  if ((b1 & 4) === 0) muted.add(10);
  if ((b1 & 2) === 0) muted.add(9);
  if ((b1 & 1) === 0) muted.add(8);
  if ((b2 & 128) === 0) muted.add(7);
  if ((b2 & 64) === 0) muted.add(6);
  if ((b2 & 32) === 0) muted.add(5);
  if ((b2 & 16) === 0) muted.add(4);
  if ((b2 & 8) === 0) muted.add(3);
  if ((b2 & 4) === 0) muted.add(2);
  if ((b2 & 2) === 0) muted.add(1);
  if ((b2 & 1) === 0) muted.add(0);
  return muted;
}

function parseMutedChords(b1: number, b2: number, b3: number, b4: number, b5: number): Set<string> {
  const muted = new Set<string>();
  const addIf = (bitSet: boolean, index: number) => {
    if (!bitSet) {
      const name = yamChordOrder[index];
      if (name) {
        muted.add(name);
      }
    }
  };
  addIf((b1 & 2) !== 0, 0);
  addIf((b1 & 1) !== 0, 1);
  addIf((b2 & 128) !== 0, 2);
  addIf((b2 & 64) !== 0, 3);
  addIf((b2 & 32) !== 0, 4);
  addIf((b2 & 16) !== 0, 5);
  addIf((b2 & 8) !== 0, 6);
  addIf((b2 & 4) !== 0, 7);
  addIf((b2 & 2) !== 0, 8);
  addIf((b2 & 1) !== 0, 9);
  addIf((b3 & 128) !== 0, 10);
  addIf((b3 & 64) !== 0, 11);
  addIf((b3 & 32) !== 0, 12);
  addIf((b3 & 16) !== 0, 13);
  addIf((b3 & 8) !== 0, 14);
  addIf((b3 & 4) !== 0, 15);
  addIf((b3 & 2) !== 0, 16);
  addIf((b3 & 1) !== 0, 17);
  addIf((b4 & 128) !== 0, 18);
  addIf((b4 & 64) !== 0, 19);
  addIf((b4 & 32) !== 0, 20);
  addIf((b4 & 16) !== 0, 21);
  addIf((b4 & 8) !== 0, 22);
  addIf((b4 & 4) !== 0, 23);
  addIf((b4 & 2) !== 0, 24);
  addIf((b4 & 1) !== 0, 25);
  addIf((b5 & 128) !== 0, 26);
  addIf((b5 & 64) !== 0, 27);
  addIf((b5 & 32) !== 0, 28);
  addIf((b5 & 16) !== 0, 29);
  addIf((b5 & 8) !== 0, 30);
  addIf((b5 & 4) !== 0, 31);
  addIf((b5 & 2) !== 0, 32);
  addIf((b5 & 1) !== 0, 33);
  return muted;
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
  const mutedNotesByte1 = reader.readUInt8();
  const mutedNotesByte2 = reader.readUInt8();
  const mutedChordByte1 = reader.readUInt8();
  const mutedChordByte2 = reader.readUInt8();
  const mutedChordByte3 = reader.readUInt8();
  const mutedChordByte4 = reader.readUInt8();
  const mutedChordByte5 = reader.readUInt8();
  const sourceChordNote = reader.readUInt8();
  const sourceChordType = reader.readUInt8();
  const chordName = mapSourceChordType(sourceChordType);

  info.channelMap.set(srcChannel, destChannel);
  info.sourceChordByChannel.set(srcChannel, sourceChordNote);
  if (chordName) {
    info.sourceChordTypeByChannel.set(srcChannel, chordName);
  }
  const mutedNotes = parseMutedNotes(mutedNotesByte1, mutedNotesByte2);
  if (mutedNotes.size > 0) {
    info.mutedNotesByChannel.set(srcChannel, mutedNotes);
  }
  const mutedChords = parseMutedChords(
    mutedChordByte1,
    mutedChordByte2,
    mutedChordByte3,
    mutedChordByte4,
    mutedChordByte5
  );
  if (mutedChords.size > 0) {
    info.mutedChordsByChannel.set(srcChannel, mutedChords);
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
    mutedNotesByChannel: new Map(),
    mutedChordsByChannel: new Map(),
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
