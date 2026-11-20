// Permite ejecutar módulos TypeScript del proyecto con Node directamente (sin servidor ni herramientas extra):
// resuelve el alias «@/» y las importaciones sin extensión, y convierte TypeScript con el compilador del proyecto.
const ts = createRequire(import.meta.url)("typescript")
import { existsSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { registerHooks } from "node:module"
import { dirname, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")
const EXT = [".ts", ".tsx", "/index.ts", "/index.tsx"]

function tryFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const e of EXT) if (existsSync(base + e)) return base + e
  return null
}

registerHooks({
  resolve(specifier, context, next) {
    let base = null
    if (specifier.startsWith("@/")) base = resolvePath(ROOT, specifier.slice(2))
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !/\.(m?js|json|cjs)$/.test(specifier)) {
      base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
    }
    if (base) {
      const hit = tryFile(base)
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url) && !url.includes("/node_modules/")) {
      const source = readFileSync(fileURLToPath(url), "utf8")
      const out = ts.transpileModule(source, { fileName: fileURLToPath(url), compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false } })
      return { format: "module", source: out.outputText, shortCircuit: true }
    }
    return next(url, context)
  },
})
