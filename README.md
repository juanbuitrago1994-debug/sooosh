# CV Tailor

Adapta tu CV a cada oferta de trabajo, **sin inventar nada y sin gastar un centavo**: todo corre en tu equipo con un modelo local ([Ollama](https://ollama.com)). Tus datos no salen de tu computadora.

## Qué hace

1. **Perfil** — subes tu CV (PDF, DOCX, DOC, ODT, RTF, TXT, MD o una foto con OCR) y lo revisas en un formulario.
2. **Oferta** — pegas el texto de la oferta o traes su enlace; el modelo local la estructura (requisitos, deseables, funciones).
3. **Análisis** — compara los requisitos de la oferta con tu CV por palabras y por significado (también entre español e inglés): qué ya encaja, qué se puede reformular con lo que ya dices y qué es una **brecha** (esto nunca se inventa).
4. **Revisión** — el modelo propone cambios (reformular, quitar, añadir) y cada uno trae **motivo, evidencia exacta de tu CV y nivel de riesgo**. Un **verificador determinista** rechaza cualquier cifra, fecha, empresa o herramienta que no esté en tu CV. Decides de a uno con atajos de teclado (A aceptar · R rechazar · E editar) o apruebas de golpe los de bajo riesgo.
5. **Exportar** — PDF de 1–2 páginas, una columna y texto seleccionable (apto para ATS), con vista previa.
6. **Historial** — cada PDF descargado queda guardado **solo en tu navegador** para reabrirlo o volver a descargarlo.

## Requisitos

| Qué | Para qué |
| --- | --- |
| Node.js 20 o superior y [pnpm](https://pnpm.io) | ejecutar la app |
| [Ollama](https://ollama.com) con un modelo descargado | leer el CV y la oferta y reescribir |
| Chromium de Playwright | crear el PDF (se instala con un comando) |

## Instalación

```bash
pnpm install
pnpm exec playwright install chromium     # navegador local para el PDF
cp .env.example .env.local                 # y ajusta OLLAMA_URL / OLLAMA_MODEL si hace falta
```

### Ollama

```bash
ollama serve                    # o abre la aplicación de Ollama
ollama pull qwen2.5:7b-instruct # el modelo por defecto de .env.example
ollama pull bge-m3              # embeddings multilingües para comparar tu CV con la oferta (~1,2 GB)
ollama list                     # comprueba que aparecen
```

Puedes usar otro modelo cambiando `OLLAMA_MODEL`. Si Ollama no responde, la app te lo dice en español y muestra estos mismos pasos.

> El OCR de fotos descarga una sola vez los datos de idioma (~15 MB) en `data/tessdata`; después funciona sin conexión.

## Uso

```bash
pnpm dev      # http://localhost:3000
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | servidor de desarrollo (puerto 3000) |
| `pnpm build` / `pnpm start` | compilar y servir en producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript sin emitir (`tsc --noEmit`) |
| `pnpm test` | pruebas (Vitest; el PDF se prueba con Chromium real) |
| `pnpm shots <nombre>` | capturas a 375/768/1280 px en claro y oscuro en `docs/shots/<nombre>/` |
| `pnpm a11y` | auditoría de accesibilidad (axe-core + teclado) |

`shots` y `a11y` usan el servidor de `pnpm dev` ya en marcha y **no inician servidores**; simulan Ollama con datos ficticios, pero el PDF y el historial son reales.

Verificación completa antes de dar algo por terminado:

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

## Lo que he aprendido (memoria de preferencias)

Cada decisión que tomas en la revisión (aceptar, rechazar, editar y, si quieres, el motivo) se guarda en una base **SQLite local** (`data/learning.db`, con Drizzle). Cada 10 decisiones nuevas el modelo local resume **reglas de redacción** (p. ej. "viñetas de una sola línea"), que junto con pocos ejemplos que aceptaste o editaste se incluyen en las instrucciones de la siguiente reescritura. Las reglas se ven, se editan, se desactivan y se reinician desde el icono del cerebro.

> **Esto no es entrenamiento del modelo.** El modelo no cambia: solo recuerda tus preferencias en el prompt. Las reglas de "nunca inventar" siempre mandan sobre ellas.

## Privacidad y costo

- **Costo cero**: solo Ollama local y librerías de código abierto. Ninguna API de pago, ninguna clave.
- **Tus archivos** se guardan en `data/` (ignorada por git). El **historial** vive en `localStorage` de tu navegador.
- Al traer una oferta por enlace, el servidor descarga esa página pública; se bloquean direcciones de red local.

## Estructura

```
app/            rutas, API (/api/upload, cv/parse, offer, rewrite, export) y páginas de error
components/     wizard, pasos, historial y componentes de shadcn/ui
lib/            extracción de texto, IA (Ollama), palabras clave, verificador, plantilla PDF, historial
tests/          pruebas y fixtures
scripts/        capturas y auditoría de accesibilidad
docs/           PLAN.md (fases), STATUS.md (estado y qué revisar)
```

## Reglas del proyecto

Interfaz solo con componentes y tokens semánticos de shadcn, todo en español, responsiva (móvil, tableta, escritorio), y **nunca inventar datos del CV**. Ver `CLAUDE.md` y `docs/PLAN.md`.

## Límites conocidos

- El verificador detecta datos inventados, **no mala redacción**: revisa siempre el diff antes de exportar.
- El modelo local es lento (decenas de segundos por puesto) y su calidad depende del modelo elegido.
- Algunos portales de empleo exigen iniciar sesión o cargan con JavaScript: en ese caso pega el texto de la oferta.
