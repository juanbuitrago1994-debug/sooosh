// Programa la sincronización diaria en macOS (launchd): `pnpm sync:install` (instalar) · `pnpm sync:uninstall` (quitar).
// Corre cada 3 horas (y al iniciar sesión) mientras el Mac esté encendido: lee lo que GitHub no puede (Get on Board) y estructura ofertas con IA local.
// Cada fuente tiene su cadencia, así que repetir la corrida no vuelve a leer de más. No usa servidores ni cuentas.
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
  <key>StartInterval</key><integer>10800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${join(root, "data", "sync-launchd.log")}</string>
  <key>StandardErrorPath</key><string>${join(root, "data", "sync-launchd.log")}</string>
</dict></plist>
`
writeFileSync(plistPath, plist)
launchctl("bootout", `gui/${uid}/${LABEL}`) // por si ya estaba instalada
const err = launchctl("bootstrap", `gui/${uid}`, plistPath)
if (err) { console.error("No se pudo activar:", err); process.exit(1) }
console.log(`Sincronización instalada (cada 3 h mientras el Mac esté encendido). Archivo: ${plistPath}\nRegistro: data/sync.log · Probar ya: pnpm sync · Quitar: pnpm sync:uninstall`)
