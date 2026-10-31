/** Wachsender Byte-Puffer für kanonische Kodierungen. */
export class ByteWriter {
  private buf = new Uint8Array(64);
  private len = 0;

  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  u8(v: number): void {
    this.ensure(1);
    this.buf[this.len++] = v & 255;
  }

  /** Vorzeichenbehaftetes Byte, -128…127. */
  i8(v: number): void {
    this.u8(v < 0 ? v + 256 : v);
  }

  /** 32 Bit, niedrigstes Byte zuerst. */
  u32(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }

  /** Vorzeichenlose Zahl als LEB128 (7 Bit pro Byte), 0 ≤ v < 2^32. */
  varint(v: number): void {
    let x = v >>> 0;
    while (x >= 128) {
      this.u8((x & 127) | 128);
      x >>>= 7;
    }
    this.u8(x);
  }

  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

export class ByteReader {
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {}

  get done(): boolean {
    return this.pos >= this.buf.length;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new Error('Daten zu kurz');
    return this.buf[this.pos++];
  }

  i8(): number {
    const v = this.u8();
    return v >= 128 ? v - 256 : v;
  }

  u32(): number {
    return (this.u8() | (this.u8() << 8) | (this.u8() << 16) | (this.u8() << 24)) >>> 0;
  }

  varint(): number {
    let v = 0;
    let mul = 1;
    for (let i = 0; i < 5; i++) {
      const b = this.u8();
      v += (b & 127) * mul;
      if (b < 128) return v;
      mul *= 128;
    }
    throw new Error('Ungültige Zahl in den Daten');
  }

  bytes(n: number): Uint8Array {
    if (this.pos + n > this.buf.length) throw new Error('Daten zu kurz');
    const out = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

/** UTF-8 ohne TextEncoder, damit der Sim-Kern nichts aus der Umgebung braucht. */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < b.length) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}
