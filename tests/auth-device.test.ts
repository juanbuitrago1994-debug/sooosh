import { beforeAll, describe, expect, it } from "vitest"
import { REMEMBER_DAYS, SESSION_HOURS, deviceCookieOptions, deviceExpiry, signDevice, verifyDevice } from "@/lib/auth/device"
import { COUNTRY_CODES, dedupeRoles, profileSchema } from "@/lib/auth/profile-schema"

const user = "11111111-1111-4111-8111-111111111111"
const dev = "22222222-2222-4222-8222-222222222222"

beforeAll(() => {
  process.env.AUTH_DEVICE_SECRET = "x".repeat(40)
})

describe("cookie de dispositivo", () => {
  it("firma y verifica", async () => {
    const exp = Date.now() + 60_000
    const v = await signDevice({ id: dev, userId: user, expiresAt: exp, remember: true })
    expect(await verifyDevice(v)).toEqual({ id: dev, userId: user, expiresAt: exp, remember: true })
  })

  it("rechaza una cookie manipulada (otro usuario, otro dispositivo o «recordar» cambiado)", async () => {
    const v = await signDevice({ id: dev, userId: user, expiresAt: Date.now() + 60_000, remember: false })
    const [id, u, exp, rem, sig] = v.split(".")
    expect(await verifyDevice([id, "33333333-3333-4333-8333-333333333333", exp, rem, sig].join("."))).toBeNull()
    expect(await verifyDevice([id, u, exp, "1", sig].join("."))).toBeNull()
    expect(await verifyDevice([id, u, String(Number(exp) + 1e9), rem, sig].join("."))).toBeNull()
  })

  it("rechaza una vencida, una vacía y una mal formada", async () => {
    expect(await verifyDevice(await signDevice({ id: dev, userId: user, expiresAt: Date.now() - 1, remember: true }))).toBeNull()
    expect(await verifyDevice(undefined)).toBeNull()
    expect(await verifyDevice("a.b.c")).toBeNull()
  })

  it("sin firmar con el secreto de este servidor no pasa", async () => {
    const v = await signDevice({ id: dev, userId: user, expiresAt: Date.now() + 60_000, remember: true })
    process.env.AUTH_DEVICE_SECRET = "y".repeat(40)
    expect(await verifyDevice(v)).toBeNull()
    process.env.AUTH_DEVICE_SECRET = "x".repeat(40)
  })

  it("duración y tipo de cookie: persistente solo si se marcó «Mantener sesión»", () => {
    const now = 1_000_000
    expect(deviceExpiry(true, now) - now).toBe(REMEMBER_DAYS * 86_400_000)
    expect(deviceExpiry(false, now) - now).toBe(SESSION_HOURS * 3_600_000)
    expect(deviceCookieOptions(true, now + 5)).toMatchObject({ httpOnly: true, sameSite: "lax", expires: new Date(now + 5) })
    expect(deviceCookieOptions(false, now)).not.toHaveProperty("expires")
  })
})

describe("registro", () => {
  it("acepta un registro válido y recorta espacios", () => {
    const p = profileSchema.safeParse({ name: "  Ana Pérez ", country: "CO", roleInterests: ["Diseñadora de producto"] })
    expect(p.success && p.data.name).toBe("Ana Pérez")
  })
  it("exige nombre, país de la lista y al menos un cargo", () => {
    expect(profileSchema.safeParse({ name: "A", country: "CO", roleInterests: ["x y"] }).success).toBe(false)
    expect(profileSchema.safeParse({ name: "Ana", country: "ZZ", roleInterests: ["Dev"] }).success).toBe(false)
    expect(profileSchema.safeParse({ name: "Ana", country: "CO", roleInterests: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ name: "Ana", country: "CO", roleInterests: Array.from({ length: 11 }, (_, i) => `Cargo ${i}`) }).success).toBe(false)
  })
  it("quita cargos repetidos sin distinguir mayúsculas", () => {
    expect(dedupeRoles(["Data Analyst", "data  analyst", " ", "QA"])).toEqual(["Data Analyst", "QA"])
  })
  it("la lista de países no repite códigos y Colombia va primero", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
    expect(COUNTRY_CODES[0]).toBe("CO")
  })
})
