import { inflateRawSync } from "node:zlib"

/**
 * Lector mínimo de .zip (lo que es un .docx), sin dependencias: recorre el directorio central y descomprime cada entrada (almacenada o
 * deflate). Solo lectura; sin cifrado, sin zip64 ni archivos partidos.
 */
export function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("No es un archivo .zip válido.")
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Directorio del .zip dañado.")
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    if (!name.endsWith("/")) out.set(name, method === 0 ? raw : method === 8 ? inflateRawSync(raw) : Buffer.alloc(0))
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}
