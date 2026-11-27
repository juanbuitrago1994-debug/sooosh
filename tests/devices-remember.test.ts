import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { REMEMBER_DAYS, SESSION_HOURS } from "@/lib/auth/device"
import { updateDeviceRemember } from "@/lib/auth/devices"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"

const ana = "11111111-1111-4111-8111-111111111111"
const luis = "22222222-2222-4222-8222-222222222222"
type Client = { exec: (q: string) => Promise<unknown>; query: <T>(q: string) => Promise<{ rows: T[] }> }

describe("«Mantener sesión iniciada» se elige en Ajustes", () => {
  let db: Db
  let client: Client
  let dev: string
  const NOW = Date.UTC(2026, 10, 27, 12)
  beforeEach(async () => {
    db = await createTestDb()
    client = (db as unknown as { $client: Client }).$client
    await client.exec("create schema auth; create table auth.users (id uuid primary key);")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    await client.exec("create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(readFileSync(path.join(process.cwd(), "db/migrations/0016_accounts.sql"), "utf8"))
    dev = (await client.query<{ id: string }>(`insert into public.trusted_devices (user_id, remember, expires_at) values ('${ana}', false, now()) returning id`)).rows[0].id
  })

  it("activarlo: el dispositivo queda recordado 30 días; desactivarlo: vuelve a sesión de 12 h", async () => {
    expect(await updateDeviceRemember(db, ana, dev, true, NOW)).toBe(NOW + REMEMBER_DAYS * 86_400_000)
    let r = (await client.query<{ remember: boolean; exp: string }>(`select remember, extract(epoch from expires_at)::bigint * 1000 as exp from public.trusted_devices where id = '${dev}'`)).rows[0]
    expect(r.remember).toBe(true)
    expect(Number(r.exp)).toBe(NOW + REMEMBER_DAYS * 86_400_000)
    expect(await updateDeviceRemember(db, ana, dev, false, NOW)).toBe(NOW + SESSION_HOURS * 3_600_000)
    r = (await client.query<{ remember: boolean; exp: string }>(`select remember, extract(epoch from expires_at)::bigint * 1000 as exp from public.trusted_devices where id = '${dev}'`)).rows[0]
    expect(r.remember).toBe(false)
  })
  it("solo toca un dispositivo propio y no revocado", async () => {
    expect(await updateDeviceRemember(db, luis, dev, true, NOW)).toBeNull() // dispositivo de otra persona
    await client.exec(`update public.trusted_devices set revoked_at = now() where id = '${dev}'`)
    expect(await updateDeviceRemember(db, ana, dev, true, NOW)).toBeNull() // revocado
    expect(await updateDeviceRemember(db, ana, "33333333-3333-4333-8333-333333333333", true, NOW)).toBeNull()
  })
})
