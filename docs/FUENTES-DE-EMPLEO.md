# Fuentes de empleo para Colombia, Chile y Argentina (investigación del 19-nov-2026)

Objetivo: que Sooosh funcione como un «puerto» al que se conectan fuentes verificadas de ofertas (adaptadores), con muchas más ofertas que las cargadas a mano. Criterio: **solo fuentes con API o feed público y términos que lo permitan**; nada de rastrear sitios que no lo autorizan.

Leyenda de confianza: **Probado** = lo llamé yo hoy y devolvió datos · **Docs** = lo dice la documentación oficial que leí · **Sin verificar** = no pude confirmarlo (se indica qué falta).

## A. Se pueden usar ya (API pública, sin clave)

| Fuente | Cobertura | Acceso | Confianza |
|---|---|---|---|
| **Get on Board** (`/api/v0/search/jobs`) | 979 ofertas: Chile 499, remotas 386, Colombia 35, Perú 32, México 25, Uruguay 9, Argentina 8 | JSON sin clave: país(es), modalidad, seniority, salario, tags, fecha, enlace público. Se pagina con `per_page=100` (10 páginas). El filtro `country` no filtra: se filtra localmente por `countries` | **Probado** (términos no leídos: la página de términos dio 404; su `robots.txt` bloquea a bots de entrenamiento de IA con «ai-train=no, use=reference»; conviene pedir permiso) |
| **Greenhouse** (`boards-api.greenhouse.io/v1/boards/{token}/jobs`) | Por empresa. Probado: **Cabify** 46 ofertas (23 en Bogotá/Santiago), **Clara** 140 (39 en CO/AR/MX/BR), Bold 1, Okta 366 (0 en la región) | JSON sin clave, sin búsqueda ni filtros | **Probado** |
| **Lever** (`api.lever.co/v0/postings/{sitio}`) | Probado: **Despegar** 111 (38 en Argentina), **Fintual** 4 (3 en Chile), Kavak 5 | JSON sin clave, con filtros `location`, `team`, `commitment` | **Probado** |
| **Ashby** (`api.ashbyhq.com/posting-api/job-board/{nombre}`) | Probado: **Addi** 33 (32 en Colombia), **Mural** 12 (5 en Argentina remoto), Belvo 3 | JSON sin clave | **Probado** |
| **Workable, Recruitee, Personio, SmartRecruiters** | Por empresa | Recruitee `…recruitee.com/api/offers`, Workable `apply.workable.com/api/v1/widget/accounts/{x}`, Personio XML | **Docs** de terceros ([fantastic.jobs](https://fantastic.jobs/article/ats-with-api)); no probado |

Los tokens de empresa no se adivinan bien: de ~100 intentos solo 15 tableros existían. Hace falta un **directorio de empresas** (ver «Descubrimiento»).

## B. Remotas internacionales con API gratuita (con condiciones)

| Fuente | Qué da | Condiciones leídas | Confianza |
|---|---|---|---|
| **Himalayas** (`/jobs/api/search`) | Filtro `country` (ISO: CO, AR, CL), excluye o incluye remotas «worldwide», salario, huso horario | Sin clave o con clave gratis (60 pet./min). Mostrar el enlace de postulación tal cual y la fuente; **no pasar las ofertas a otros agregadores**; quitar las vencidas; mostrarlas solo en sitios propios | **Docs** |
| **Jobicy** (`/api/jobs`) | Remotas, `geo` por país (Argentina está; Colombia y Chile no aparecen en su lista) | 1 pet./s; solo últimas 7 días; atribución; los enlaces de postulación quedan en Jobicy; se puede guardar, marcando las cerradas | **Docs** |
| **Remotive** (`/api/remote-jobs`) | Remotas; hay ofertas «LATAM» | Máx. ~4 pet./día, con 24 h de retraso; atribución; **mostrar ofertas para captar registros es violación** (relevante cuando haya cuentas) | **Docs** |

## C. Sin API pública (no conectarse por rastreo)

| Fuente | Qué encontré | Decisión |
|---|---|---|
| **Computrabajo** (CO, CL, AR) | Sin API oficial; solo scrapers de terceros ([Apify](https://apify.com/santamaria-automations/computrabajo-scraper)). No pude leer su `robots.txt` ni sus términos | No rastrear. Pedir un feed de socio |
| **elempleo.com** (CO) | `robots.txt` **prohíbe** `/colombia/JobOffers/` y bloquea los bots de *jooble*, *linkedin* y *neuvoo*; sus términos limitan el uso a personal y no comercial | No usar |
| **Bumeran / Zonajobs** (AR), **Laborum** (CL) | Misma plataforma (Navent). Sin API pública; `robots.txt` permite las ofertas y publica un sitemap de avisos, pero los scrapers usan su JSON interno. Términos no leídos | No rastrear. Pedir un feed |
| **Trabajando.cl, Chiletrabajos.cl** (CL) | `robots.txt` no bloquea las ofertas; sin API; términos no leídos | No rastrear sin permiso |
| **Servicio Público de Empleo** (CO) | Publica estadísticas (DataEmpleo) y el buscador integra vacantes de muchos prestadores; sin API ni datos abiertos de vacantes hallados; su `robots.txt` no se pudo leer (error de certificado) | Escribir al SPE |
| **BNE / SENCE** (CL) | Conectada a portales municipales; sin API hallada; `robots.txt` permite las ofertas; su «SABE» mide bolsas privadas. Contacto `soporte@bne.cl` | Escribir a SENCE |
| **Portal Empleo** (AR, Ministerio de Capital Humano) | ~400 vacantes; sin datos abiertos hallados | Escribir al Ministerio |
| **Torre** | API de profesionales y empresas en beta privada | Pedir acceso |
| **Jooble** | Requiere clave; elempleo lo bloquea | Descartado por la regla «sin claves» |
| **Indeed, LinkedIn** | Ver análisis anterior (sin API pública / términos) | Solo entrada manual |

## Descubrimiento de empresas (cómo crece el directorio)
1. Al cargar una oferta a mano con un enlace de `boards.greenhouse.io/<token>`, `jobs.lever.co/<sitio>` o `jobs.ashbyhq.com/<nombre>`, el sistema **registra el tablero entero** de esa empresa.
2. Lista curada de empresas LATAM (fintech, retail, tech) que Juan va agregando.
3. Empresas que conectan su propio tablero (autoservicio, más adelante).

## Mediciones propias
- Get on Board: 979 ofertas leídas en 10 páginas de 100 (≈ 12 s con 1,2 s de pausa).
- Encaje con el CV: **7,6 ms por oferta** (1 000 ofertas sintéticas contra el CV real = 7,6 s). Por eso el orden por encaje se calcula solo sobre las ~100–200 mejores candidatas tras filtrar por región y por texto/significado, no sobre todas.

---

# Ampliación del 28-nov-2026: México, Colombia, España y el resto de Latinoamérica

Pedida por Juan: todos los portales posibles, con foco en **México, Colombia y España**. Se midieron **126 sitios** (≈ 25 de MX/CO/ES, el resto de 18 países y fuentes remotas) con el lector de `robots.txt` y de sitemaps que ya usa Sooosh (`lib/sources/portals/*`), con nuestra identidad `SoooshBot` y pausas de 1,5 s (3 a 4 peticiones por sitio). Datos crudos: `docs/fuentes-sondeo-2026-11-28.json`; script: `docs/fuentes-sondeo-2026-11-28.probe.mjs.txt` (renombrado para que no se ejecute solo; copiarlo a `.mjs` y poner la lista de sitios en `sites.json`).

**Qué mide y qué NO mide.** Por sitio: (1) ¿se puede leer su `robots.txt`?, (2) ¿permite lo que pedimos?, (3) ¿tiene sitemap con ofertas?, (4) ¿una página de oferta trae JSON-LD `JobPosting` completo? Eso dice si **técnicamente** cabe en nuestro lector de portales. **No dice si tenemos permiso**: un `robots.txt` abierto no autoriza reutilizar el contenido. Los términos de uso solo se leyeron para tres sitios (abajo). Limitaciones: una página de ejemplo por sitio (la sonda a veces eligió un blog o una categoría; donde pasó, se repitió a mano con una oferta real), y algunos `robots.txt` responden distinto según el momento (OCC y Magneto dieron resultados distintos entre dos pasadas; se anota la lectura repetida).

## 1. Leíbles hoy con nuestro lector (robots abierto + sitemap + JSON-LD completo)

| País | Portal | Ofertas en sitemap | Verificado | Permiso / términos |
|---|---|---|---|---|
| **CO** | **Magneto365** (3.º en tráfico de Colombia) | **38.681** URLs, todas con fecha de hoy | `robots.txt` permite todo salvo `/*?` y `/manager`, **invita a bots de IA** y publica `llms.txt`; la oferta trae JobPosting con título, fecha, vigencia, empresa, lugar, tipo y descripción | Los términos de uso **no se pudieron aislar** (la página legal que se obtuvo era la política de datos). **Pedir confirmación por escrito antes de leer.** |
| **ES** | **Infoempleo** | **8.807** activas | JobPosting completo (incluye `validThrough`); `robots.txt` solo prohíbe filtros | Su aviso legal **prohíbe** reproducir los contenidos y obtenerlos por medios distintos a los que ofrece, y el uso comercial, **sin autorización**. **No leer sin permiso.** |
| **ES** | **Jobtoday** (hostelería y turnos) | **34.791** (país `es`) | JobPosting con fecha, vigencia y lugar | Sus términos prohíben «apropiarse de los datos de la plataforma para beneficio comercial propio». **Consultar.** |
| **ES** | **Manfred** (tecnología) | 22 | JobPosting con salario | Términos no leídos. Pocas ofertas |
| **ES** | **Domestika** (creativos) | 265 | JobPosting con fecha y lugar | Términos no leídos |
| PE | **Laborum PE** | ≥ 49.999 | JobPosting completo | Términos no leídos |
| CL | **Trabajando.cl** | 11.612 | JobPosting completo | Términos no leídos |
| UY | **Gallito Trabajo** | 860 | JobPosting completo | Términos no leídos |

## 2. `robots.txt` abierto pero sin datos estructurados

Familia **Navent**: Bumeran (MX, CO, AR, PE, BO), Zonajobs, Laborum CL, Multitrabajos (EC), Konzerta (PA). `robots.txt` permite las ofertas y publica sitemap (Bumeran MX: 5.801 avisos), pero la página de oferta **no trae JSON-LD ni microdatos** (comprobado en una oferta real de Bumeran MX). Leerlos exige un extractor HTML por sitio, frágil. Otros en esta situación: Vagas.com y Catho (BR), Buscojobs (UY, PY), Empleos.net y Vacantes.com (MX).

## 3. Bloquean a nuestro identificador (no se entra, por regla)

`robots.txt` responde **403** a `SoooshBot` (repetido): **Computrabajo en todos los países**, **OCC Mundial** (MX), **Tecnoempleo** y **Randstad** (ES), Jobrapido, Adzuna (el sitio; su API es otra cosa), Glassdoor, Jobatus y Empléate (SEPE) no respondieron. Nunca fingimos ser un navegador, así que quedan fuera.

## 4. Prohíben las ofertas o no son leíbles por este método

Jobrapido (`/job/*`), **elempleo** (`/colombia/JobOffers/` y términos ya leídos el 19-nov), Indeed (sin sitemap legible; términos), LinkedIn, Jooble y Talent.com (sitemaps solo `.gz` o sin ofertas).

## 5. APIs y datos oficiales (lo más sólido a largo plazo)

| Fuente | Estado | Siguiente paso |
|---|---|---|
| **InfoJobs API** (ES) | Existe API oficial con búsqueda de ofertas, candidaturas y CV; hay que registrar una aplicación con una cuenta de InfoJobs. Condiciones de uso **no leídas** | Registrar la app y leer las condiciones: ¿se pueden guardar y mostrar sus ofertas? |
| **Adzuna API** (MX, quizá ES) | Clave gratuita (`app_id` + `app_key`); código `mx` confirmado en documentación de terceros; **España no confirmada**; sus términos no se leyeron | Pedir clave y consultar `/jobs/mx/search`; verificar país y condiciones. Requiere una clave (decisión de Juan) |
| **Jooble API** | Requiere clave; ya descartado el 19-nov | — |
| **Servicio Público de Empleo** (CO) | Por la **Ley 1636 de 2013** los empleadores deben registrar vacantes; ≈ 265.000 vacantes; su sitio institucional es WordPress y el buscador (`buscadordeempleo.gov.co`) es una aplicación de JavaScript. **No hallé API ni datos abiertos de vacantes** | Escribir al SPE y a MinTrabajo pidiendo un feed (hay norma de estructura de datos: Resolución 0029 de 2015) |
| **SEPE / Empléate** (ES) | Existe una **solicitud ciudadana** en datos.gob.es para publicar las ofertas como datos abiertos; no confirmé que esté publicada. Su `robots.txt` no respondió | Revisar el catálogo de datos abiertos del SEPE |
| **Servicio Nacional de Empleo** (MX) | Sin API; el único conjunto de datos hallado es estatal y de 2018. Hubo una filtración en 2024 (cuidado) | Escribir a la STPS |
| **EURES** (UE) | Portal europeo; sitemap sin ofertas por URL; API solo para miembros | Consultar acceso |

## 6. Lectura por país

- **Colombia** (mejor posición): **Magneto365** es la fuente grande y técnicamente más limpia; falta el permiso. Computrabajo y elempleo están fuera. El **Servicio Público de Empleo** sería la fuente oficial y más legítima si entregan un feed.
- **España**: Infoempleo y Jobtoday son técnicamente excelentes pero sus términos exigen autorización; **InfoJobs tiene API oficial** (camino más sano); Tecnoempleo y Randstad bloquean; hay nicho útil en Manfred (tecnología) y Domestika (creativos).
- **México** (la más difícil): **OCC y Computrabajo bloquean**, Indeed y LinkedIn no, Bumeran MX no trae datos estructurados. Camino realista: **Adzuna API (`mx`)**, Get on Board (ya conectada, ~25 ofertas MX), ATS por empresa (Greenhouse, Lever, Ashby) y, si lo aprueba Juan, un extractor HTML para Bumeran MX.
- **Resto**: Laborum PE (≥ 50 mil), Trabajando.cl y Gallito UY son leíbles; la familia Navent necesita extractor propio.

## 7. Decisión pendiente de Juan

No se agregó ningún portal al código. Antes de hacerlo hay que decidir, por fuente, entre **pedir permiso por escrito** (Magneto, Infoempleo, Jobtoday, Laborum, Trabajando.cl, Gallito, SPE) y **usar APIs oficiales** (InfoJobs, Adzuna). Leer sin permiso un sitio cuyos términos lo limitan es un riesgo legal del producto, aunque el `robots.txt` lo deje pasar.

## 8. Actualización del mismo día: Magneto365 conectada y correcciones a la medición

- **Magneto365 está en el código** (`MAGNETO` en `lib/sources/portals/portal.ts`, migración `0022_source_magneto.sql`, ficha en `status.ts`). Corrida real de prueba con la función de producción: 38.681 avisos en el sitemap y 3 ofertas leídas con país `CO`, familia de cargo y fecha de hoy. Solo trae cargos de tecnología (como Chiletrabajos y Trabajando.cl); para traer todos los cargos hay que cambiar `onlyTech` en `sync.ts` (decisión de producto). **Todavía no está desplegada ni activa en producción**: falta aplicar la migración en Supabase y subir el código.
- **Juan informó** (28-nov-2026) que los portales con los que habló le dieron libertad de consumir sus ofertas por medios tecnológicos. Esta ficha no registra cuáles ni por escrito; conviene anotar aquí, por portal, quién lo confirmó y cuándo. Aun con permiso, el lector mantiene sus reglas: respeta `robots.txt`, se identifica como SoooshBot y se detiene ante 401/403/429/5xx; no finge ser un navegador.
- **Corrección a la medición.** El primer sondeo marcó a Magneto como bloqueada por un error nuestro (UA con tilde, ver `docs/INCIDENTES.md`). Repetido el sondeo de los 39 sitios «bloqueados», **solo Magneto cambió**. Los demás 403 son reales (Computrabajo en todos los países, OCC, Tecnoempleo, Randstad, Jobrapido, Glassdoor, Adzuna, Neuvoo, Trabajos.com MX…): esos portales **nos rechazan** aunque Juan tenga su visto bueno; la salida es que nos habiliten (lista blanca del identificador SoooshBot o un feed), no esquivarlo.
- **Sitios oficiales con certificado mal armado:** `serviciodeempleo.gov.co` y `buscadordeempleo.gov.co` envían una cadena de certificados incompleta (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`): navegadores y `curl` la toleran, Node no. **No se desactiva la verificación TLS.** Opciones: avisarles del certificado, o añadir su certificado intermedio como confianza explícita (decisión de seguridad de Juan). `empleate.gob.es` no responde (tiempo de conexión agotado).

## 9. Infoempleo (España) conectada, y qué se aprendió al hacerlo (28-nov-2026)

- **Autorización**: Juan informó el 28-nov-2026 que Infoempleo le dio permiso. Su aviso legal exigía autorización escrita para reproducir contenidos; conviene archivar el mensaje en `docs/`.
- **Qué entra**: `INFOEMPLEO` en `lib/sources/portals/portal.ts` (sitemap `sitemap-ofertas-activas.xml`, ~8.800 avisos; JSON-LD completo). Solo tecnología, como los demás portales. Migración `0024_source_infoempleo.sql`.
- **Tres problemas de calidad encontrados con una muestra aleatoria de 12 ofertas reales, y arreglados** (afectan a todas las fuentes):
  1. **Reclutamiento internacional**: «10 plazas para fisioterapeutas en Alemania» trae las 50 provincias españolas como lugar. Ahora, si el título nombra un país que no atendemos y ninguno que sí, el lector descarta la oferta (`namesForeignCountry`, `lib/jobs/geo.ts`).
  2. **Ciudades homónimas**: «Marchamalo, Guadalajara, ES» se clasificaba también como México. Ahora el país que declara la fuente manda sobre las ciudades inferidas del texto (`externalToDraft`).
  3. **País por defecto**: cada portal declara su país (`PortalConfig.country`) para no adivinarlo del texto cuando la oferta no trae lugar.
- **Límite**: la muestra fue de 12 ofertas de ~8.800; no se midió la tasa real de errores de clasificación.
