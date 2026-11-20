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
