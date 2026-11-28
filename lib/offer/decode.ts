/**
 * Decodifica una página descargada como lo hace un navegador, en vez de suponer siempre UTF-8. Un sitio en `windows-1252` o `iso-8859-1` (frecuente en portales
 * antiguos de la región) leído como UTF-8 sale con «�» en cada tilde y la «ñ»: la oferta se ve rota, el extractor pierde palabras y hasta se pasa por alto la frase
 * «ya no está disponible» de una oferta cerrada. La idea sale de `tools/page_decode.py` de ai-job-search-dev/ai-job-search (MIT).
 *
 * Orden: (1) si los bytes son UTF-8 válido, gana UTF-8 (un sitio que declara latin-1 pero sirve UTF-8 es común, y un texto latin-1 con tildes casi nunca es UTF-8 válido);
 * (2) una marca de orden de bytes UTF-16; (3) el `charset` de la cabecera `Content-Type`; (4) `<meta charset>` o `http-equiv` en los primeros 1024 bytes (lo que lee el
 * «prescan» de HTML). Solo se aceptan las etiquetas de la lista de abajo (una página no puede escoger un códec raro como UTF-7); si no hay etiqueta o es desconocida,
 * UTF-8 con caracteres de reemplazo. Nunca lanza.
 */
const PRESCAN_BYTES = 1024
const META_CHARSET = /<meta\b[^>]*?charset\s*=\s*["']?\s*([A-Za-z0-9._:-]+)/i
const HEADER_CHARSET = /charset\s*=\s*["']?\s*([A-Za-z0-9._:-]+)/i

/** códec de `TextDecoder` → etiquetas con que se declara (en minúsculas). `iso-8859-1`, `latin1` y `ascii` son `windows-1252`, como en los navegadores. */
const CODECS: Record<string, string[]> = {
  "windows-1252": ["windows-1252", "cp1252", "x-cp1252", "iso-8859-1", "iso8859-1", "iso_8859-1", "latin1", "l1", "ascii", "us-ascii", "cp819", "ibm819"],
  "windows-1250": ["windows-1250", "cp1250", "x-cp1250"],
  "windows-1251": ["windows-1251", "cp1251", "x-cp1251"],
  "windows-1253": ["windows-1253", "cp1253"],
  "windows-1254": ["windows-1254", "cp1254", "iso-8859-9", "latin5"],
  "windows-1257": ["windows-1257", "cp1257"],
  "iso-8859-2": ["iso-8859-2", "latin2", "l2"],
  "iso-8859-5": ["iso-8859-5", "cyrillic"],
  "iso-8859-15": ["iso-8859-15", "latin9", "l9"],
  "koi8-r": ["koi8-r", "koi8", "koi"],
  "koi8-u": ["koi8-u"],
  shift_jis: ["shift_jis", "shift-jis", "sjis", "x-sjis", "ms_kanji", "windows-31j", "csshiftjis"],
  "euc-jp": ["euc-jp", "x-euc-jp"],
  "euc-kr": ["euc-kr", "cp949", "windows-949", "ks_c_5601-1987", "ksc5601"],
  gb18030: ["gb18030", "gbk", "gb2312", "x-gbk", "chinese"],
  big5: ["big5", "big5-hkscs", "x-x-big5", "cn-big5"],
}
const LABEL_TO_CODEC = new Map(Object.entries(CODECS).flatMap(([codec, labels]) => labels.map((l) => [l, codec] as const)))

/** El códec que declara la página (cabecera primero, luego `<meta>`), o null si no declara ninguno que aceptemos. */
export function declaredCodec(bytes: Uint8Array, contentType?: string | null): string | null {
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return bytes[0] === 0xff ? "utf-16le" : "utf-16be"
  const fromHeader = contentType ? HEADER_CHARSET.exec(contentType)?.[1] : undefined
  const head = fromHeader ? undefined : META_CHARSET.exec(Buffer.from(bytes.subarray(0, PRESCAN_BYTES)).toString("latin1"))?.[1]
  return LABEL_TO_CODEC.get((fromHeader ?? head ?? "").toLowerCase()) ?? null
}

export function decodePage(bytes: Uint8Array, contentType?: string | null): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    /* no es UTF-8 válido: se mira lo que declara la página */
  }
  const codec = declaredCodec(bytes, contentType)
  try {
    return new TextDecoder(codec ?? "utf-8").decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}
