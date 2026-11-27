import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { buildExport } from "@/lib/account/export"
import { cvSchema } from "@/lib/schemas/cv"
import { saveValidatedCv } from "@/lib/cv-store/store"
import { saveTrackedOffer } from "@/lib/tracking/store"
import { offerSchema } from "@/lib/schemas/offer"

const ana = "11111111-1111-4111-8111-111111111111"
const luis = "22222222-2222-4222-8222-222222222222"
type Client = { exec: (q: string) => Promise<unknown>; query: <T>(q: string) => Promise<{ rows: T[] }> }

/** Las tablas que guardan datos de la persona y ya están en el archivo de exportación. Si se agrega una tabla nueva con datos de personas, esta prueba falla hasta que se exporte. */
const EXPORTED_TABLES = ["alerts", "collections", "cvs", "notifications", "profiles", "tracked_offers", "trusted_devices"]

describe("exportar y borrar la cuenta", () => {
  let db: Db
  let client: Client
  beforeEach(async () => {
    db = await createTestDb()
    client = (db as unknown as { $client: Client }).$client
    await client.exec("create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    for (const f of ["0016_accounts.sql", "0017_cvs.sql", "0018_tracked_offers.sql", "0019_collections_notes.sql", "0020_alerts_notifications.sql", "0021_profile_city.sql"]) await client.exec(readFileSync(path.join(process.cwd(), "db/migrations", f), "utf8"))
    const cv = (n: string) => cvSchema.parse({ header: { fullName: n }, summary: "", experience: [], education: [], skills: [], languages: [] })
    const offer = (t: string) => offerSchema.parse({ title: t, company: "Acme", language: "es", requirements: ["SQL"], niceToHave: [], responsibilities: [] })
    for (const [id, n] of [[ana, "Ana"], [luis, "Luis"]] as const) {
      await client.exec(`insert into public.profiles (id, name, country, role_interests) values ('${id}', '${n}', 'CO', '{Diseñador}')`)
      await client.exec(`insert into public.trusted_devices (user_id, label, expires_at) values ('${id}', 'Safari en macOS', now() + interval '1 day')`)
      await saveValidatedCv(db, id, { cv: cv(n), label: n, validatedAt: "2026-11-26T10:00:00.000Z" })
      await client.exec(`insert into public.collections (user_id, name) values ('${id}', 'Plan B')`)
      await client.exec(`insert into public.alerts (user_id, name, filters) values ('${id}', 'Datos en CO', '{"regions":["CO"]}')`)
      await client.exec(`insert into public.notifications (user_id, kind, title, href) values ('${id}', 'alerta', 'Algo nuevo', '/notificaciones')`)
      await saveTrackedOffer(db, id, { url: "https://empresa.com/e/1", offer: offer(`Oferta de ${n}`), text: `texto de ${n}` })
    }
  })

  it("el archivo trae TODO lo de la persona (perfil, CV, ofertas completas, dispositivos) y nada de otra", async () => {
    const d = await buildExport(db, ana, { email: "ana@x.com" }, new Date("2026-11-26T12:00:00Z"))
    expect(d.sooosh.exportedAt).toBe("2026-11-26T12:00:00.000Z")
    expect(d.cuenta.correo).toBe("ana@x.com")
    expect(d.perfil).toMatchObject({ nombre: "Ana", pais: "CO", cargosDeInteres: ["Diseñador"] })
    expect(d.cvs).toHaveLength(1)
    expect((d.cvs[0].cv as { header: { fullName: string } }).header.fullName).toBe("Ana")
    expect(d.ofertasGuardadas).toHaveLength(1)
    expect(d.ofertasGuardadas[0]).toMatchObject({ titulo: "Oferta de Ana", texto: "texto de Ana", categoria: null, nota: null, origen: "enlace" })
    expect(d.categorias).toHaveLength(1)
    expect(d.alertas).toMatchObject([{ nombre: "Datos en CO", condiciones: { regions: ["CO"] }, frecuencia: "cada_pasada", activa: true }])
    expect(d.notificaciones).toMatchObject([{ titulo: "Algo nuevo", leida: false }])
    expect(d.dispositivos).toHaveLength(1)
    expect(JSON.stringify(d)).not.toContain("Luis")
  })

  it("borrar a la persona (auth.users) se lleva todos sus datos y deja los de otra", async () => {
    await client.exec(`delete from auth.users where id = '${ana}'`)
    for (const t of EXPORTED_TABLES) {
      const col = t === "profiles" ? "id" : "user_id"
      expect((await client.query<{ n: number }>(`select count(*)::int as n from public.${t} where ${col} = '${ana}'`)).rows[0].n, t).toBe(0)
      expect((await client.query<{ n: number }>(`select count(*)::int as n from public.${t} where ${col} = '${luis}'`)).rows[0].n, t).toBe(1)
    }
  })

  it("toda tabla que cuelga de la persona está en la exportación (si agregas una, expórtala)", async () => {
    const r = await client.query<{ t: string }>(`select distinct conrelid::regclass::text as t from pg_constraint where confrelid = 'auth.users'::regclass and contype = 'f'`)
    expect(r.rows.map((x) => x.t.replace("public.", "")).sort()).toEqual(EXPORTED_TABLES)
  })
})
