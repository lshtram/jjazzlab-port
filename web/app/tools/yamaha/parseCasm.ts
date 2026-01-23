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

type CasmInfo = {
  channelMap: Map<number, number>;
  sourceChordByChannel: Map<number, number>;
  sourceChordTypeByChannel: Map<number, string>;
  ctb2ByChannel: Map<number, Ctb2Settings>;
};

class Reader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  readString(length: number): string {
    const value = this.buffer.toString('ascii', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readUInt8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt32(): number {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readBytes(length: number): Buffer {
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  skip(length: number): void {
    this.offset = Math.min(this.buffer.length, this.offset + length);
  }
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

function parseCtabSection(data: Buffer, info: CasmInfo, isCtb2: boolean, sffType: SffType): void {
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

  if (!info.channelMap.has(srcChannel)) {
    info.channelMap.set(srcChannel, destChannel);
  }
  if (!info.sourceChordByChannel.has(srcChannel)) {
    info.sourceChordByChannel.set(srcChannel, sourceChordNote);
  }
  if (chordName && !info.sourceChordTypeByChannel.has(srcChannel)) {
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

function parseCsegSection(data: Buffer, info: CasmInfo, sffType: SffType): void {
  const reader = new Reader(data);
  if (reader.remaining() < 8) {
    return;
  }

  const header = reader.readString(4);
  if (header !== 'Sdec') {
    return;
  }

  const sdecSize = reader.readUInt32();
  reader.skip(sdecSize);

  while (reader.remaining() >= 8) {
    const sectionName = reader.readString(4);
    const sectionSize = reader.readUInt32();
    if (sectionSize > reader.remaining()) {
      reader.skip(reader.remaining());
      break;
    }
    const section = reader.readBytes(sectionSize);
    if (sectionName === 'Ctab') {
      parseCtabSection(section, info, false, sffType);
    } else if (sectionName === 'Ctb2') {
      parseCtabSection(section, info, true, sffType);
    }
  }
}

export function parseCasmFromBuffer(buffer: Buffer, sffType: SffType): CasmInfo | null {
  const casmIndex = buffer.indexOf('CASM');
  if (casmIndex === -1) {
    return null;
  }

  if (casmIndex + 8 >= buffer.length) {
    return null;
  }

  const casmSize = buffer.readUInt32BE(casmIndex + 4);
  const casmStart = casmIndex + 8;
  const casmEnd = Math.min(buffer.length, casmStart + casmSize);
  const casmData = buffer.subarray(casmStart, casmEnd);
  const reader = new Reader(casmData);

  const info: CasmInfo = {
    channelMap: new Map(),
    sourceChordByChannel: new Map(),
    sourceChordTypeByChannel: new Map(),
    ctb2ByChannel: new Map(),
  };

  while (reader.remaining() >= 8) {
    const sectionName = reader.readString(4);
    const sectionSize = reader.readUInt32();
    if (sectionSize > reader.remaining()) {
      break;
    }
    const section = reader.readBytes(sectionSize);
    if (sectionName === 'CSEG') {
      parseCsegSection(section, info, sffType);
    }
  }

  return info;
}
