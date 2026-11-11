// Едноставен бинарен контејнер за податоците на мапата (.bin):
//   [4 B magic "BTM1"][u32 LE должина на заглавјето][JSON заглавје][подполнување до 8]
//   [типизирани низи, секоја порамнета на 8 бајти]
// Заглавјето: { meta: {...}, arrays: [{ name, type, length, offset }] }.
// Истиот модул го користат Node скриптите (encode) и прелистувачот (decode).

const TYPES = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
};

const MAGIC = 0x314d5442; // "BTM1" little-endian
const align8 = (n) => (n + 7) & ~7;

/** @param {{meta?: object, arrays: Record<string, ArrayBufferView>}} data */
export function encodePack({ meta = {}, arrays }) {
  const entries = [];
  let offset = 0;
  for (const [name, arr] of Object.entries(arrays)) {
    const type = arr.constructor.name;
    if (!TYPES[type]) throw new Error(`pack: неподдржан тип ${type} (${name})`);
    entries.push({ name, type, length: arr.length, offset });
    offset = align8(offset + arr.byteLength);
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify({ meta, arrays: entries }));
  const dataStart = align8(8 + headerBytes.length);
  const out = new Uint8Array(dataStart + offset);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, headerBytes.length, true);
  out.set(headerBytes, 8);
  const values = Object.values(arrays);
  entries.forEach((e, i) => {
    const a = values[i];
    out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), dataStart + e.offset);
  });
  return out;
}

/** @param {ArrayBuffer} buffer */
export function decodePack(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('pack: погрешен формат');
  const headerLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLen)));
  const dataStart = align8(8 + headerLen);
  const arrays = {};
  for (const e of header.arrays) {
    arrays[e.name] = new TYPES[e.type](buffer, dataStart + e.offset, e.length);
  }
  return { meta: header.meta, arrays };
}
