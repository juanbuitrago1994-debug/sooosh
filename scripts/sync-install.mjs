// Programa la sincronización diaria en macOS (launchd): `pnpm sync:install` (instalar) · `pnpm sync:uninstall` (quitar).
// Corre todos los días a las 03:30; si el equipo estaba dormido o apagado, launchd la ejecuta al despertar. No usa servidores ni cuentas.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const LABEL = "app.sooosh.sync"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const plistPath = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
const uid = process.getuid()
const remove = process.argv.includes("--remove")

if (process.platform !== "darwin") {
  console.error("Este instalador es solo para macOS (launchd). En otro sistema, programa `pnpm sync` una vez al día con el planificador que tengas.")
  process.exit(2)
}
const launchctl = (...a) => { try { execFileSync("launchctl", a, { stdio: "pipe" }) } catch (e) { return String(e.stderr ?? e.message) } }

if (remove) {
  launchctl("bootout", `gui/${uid}/${LABEL}`)
  if (existsSync(plistPath)) unlinkSync(plistPath)
  console.log("Sincronización diaria quitada.")
  process.exit(0)
}

mkdirSync(dirname(plistPath), { recursive: true })
mkdirSync(join(root, "data"), { recursive: true })
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${process.execPath}</string><string>--env-file=.env.local</string><string>scripts/sync.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>${root}</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>${join(root, "data", "sync-launchd.log")}</string>
  <key>StandardErrorPath</key><string>${join(root, "data", "sync-launchd.log")}</string>
</dict></plist>
`
writeFileSync(plistPath, plist)
launchctl("bootout", `gui/${uid}/${LABEL}`) // por si ya estaba instalada
const err = launchctl("bootstrap", `gui/${uid}`, plistPath)
if (err) { console.error("No se pudo activar:", err); process.exit(1) }
console.log(`Sincronización diaria instalada (03:30). Archivo: ${plistPath}\nRegistro: data/sync.log · Probar ya: pnpm sync · Quitar: pnpm sync:uninstall`)
