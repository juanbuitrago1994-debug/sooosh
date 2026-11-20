// Sincronización automática de ofertas: `pnpm sync` (corrida diaria; ver docs/SINCRONIZACION.md).
//   pnpm sync                      → lo que toque (cada fuente se omite si se leyó hace < 20 h)
//   pnpm sync --force              → todas, aunque se hayan leído hoy
//   pnpm sync --only=remote:jobicy → solo esas fuentes (separadas por coma)
//   pnpm sync --phase=fetch,vectors → solo esas fases (fetch = leer fuentes y vencer; vectors = vectores; enrich = IA que estructura)
//   pnpm sync --minutes=30         → presupuesto de tiempo para la IA local (por defecto 20)
//   pnpm sync --runner=cloud       → omite las fuentes que solo se pueden leer desde casa (lo usa GitHub Actions)
//   pnpm sync --pending            → imprime cuántas ofertas activas no tienen vector
//   pnpm sync --check              → solo revisa la salud: sale con error si una fuente lleva demasiado sin sincronizar
// No necesita el servidor de desarrollo: habla directo con Supabase y con Ollama usando .env.local.
import "./ts-alias.mjs"
import { appendFileSync, mkdirSync } from "node:fs"

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]
mkdirSync("data", { recursive: true })
const log = (line) => {
  const text = `${new Date().toISOString()} ${line}`
  console.log(text)
  try { appendFileSync("data/sync.log", text + "\n") } catch {}
}

const { getDb } = await import("../lib/db/index.ts")
const { runDaily, syncHealth, pendingVectors } = await import("../lib/sources/schedule.ts")
const { queueDepth } = await import("../lib/enrich/queue.ts")
try {
  if (process.argv.includes("--pending")) {
    // Para el workflow: imprime cuántas ofertas activas no tienen vector (0 = no hace falta instalar Ollama).
    console.log(await pendingVectors(getDb()))
    process.exit(0)
  }
  if (process.argv.includes("--check")) {
    const h = (await syncHealth(getDb()))
    for (const x of h) log(`${x.stale ? "✗ ATRASADA" : "✓"} ${x.label}: último éxito ${x.lastOkAt ?? "nunca"}${x.lastError ? ` · error: ${x.lastError}` : ""}`)
    const q = await queueDepth(getDb())
    log(`${q.alert ? "✗ AVISO" : "✓"} Cola de IA: ${q.pending} pendientes${q.oldestHours !== null ? `, la más antigua hace ${q.oldestHours} h` : ""}`)
    // Solo las fuentes clave hacen fallar la revisión (y con ello el aviso de GitHub): una remota caída no es una emergencia.
    process.exit(h.some((x) => x.stale && ["getonboard", "companies"].includes(x.id)) ? 1 : 0)
  }
  const s = await runDaily(getDb(), { runner: arg("runner") === "cloud" ? "cloud" : "home", phases: arg("phase")?.split(","), force: process.argv.includes("--force"), only: arg("only")?.split(","), enrichMinutes: arg("minutes") ? Number(arg("minutes")) : undefined, log })
  log(`Listo en ${Math.round(s.ms / 1000)} s`)
  process.exit(0)
} catch (e) {
  log(`ERROR: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
