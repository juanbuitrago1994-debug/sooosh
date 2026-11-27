import { describe, expect, it } from "vitest"
import { encodeLastUser, initialsOf, parseLastUser } from "@/lib/auth/last-user"

describe("último usuario de este dispositivo", () => {
  it("ida y vuelta con tildes y espacios", () => {
    const raw = encodeLastUser({ name: "  Juan Buitrago ", email: "juan.b@gmail.com" })
    expect(parseLastUser(raw)).toEqual({ name: "Juan Buitrago", email: "juan.b@gmail.com" })
    expect(parseLastUser(encodeLastUser({ name: "María Ángeles Núñez", email: "m@x.co" }))?.name).toBe("María Ángeles Núñez")
  })
  it("desconfía de cualquier cookie rara", () => {
    for (const bad of [undefined, "", "no-json", encodeURIComponent("[]"), encodeURIComponent(JSON.stringify({ n: "A", e: "no-es-correo" })), encodeURIComponent(JSON.stringify({ n: "", e: "a@b.co" })), encodeURIComponent(JSON.stringify({ n: 5, e: "a@b.co" })), encodeURIComponent(JSON.stringify({ n: "x".repeat(200), e: "a@b.co" }))])
      expect(parseLastUser(bad), String(bad)).toBeNull()
  })
  it("un correo con un salto de línea o espacios no pasa (no se cuela en la dirección de Google)", () => {
    expect(parseLastUser(encodeURIComponent(JSON.stringify({ n: "A", e: "a@b.co\nbcc:x@y.z" })))).toBeNull()
    expect(parseLastUser(encodeURIComponent(JSON.stringify({ n: "A", e: "a b@c.co" })))).toBeNull()
  })
  it("iniciales", () => {
    expect(initialsOf("Juan Buitrago")).toBe("JB")
    expect(initialsOf("madonna")).toBe("M")
    expect(initialsOf("  ")).toBe("?")
    expect(initialsOf("ana maría pérez")).toBe("AM")
  })
})
