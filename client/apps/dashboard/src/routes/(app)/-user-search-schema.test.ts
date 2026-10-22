import { userSearchQuerySchema } from "@repo/schemas/user"
import { describe, expect, it } from "vitest"

/**
 * The status filter is a radio of one state, and "Semua" is the absent param:
 * no filter, every row. Active appears in the URL only because the users route
 * seeds it on entry, so parsing must not invent it.
 */
describe("userSearchQuerySchema.deleted_at", () => {
  const parse = (deleted_at: unknown) =>
    userSearchQuerySchema.parse({ deleted_at }).deleted_at

  it("accepts one state", () => {
    expect(parse("active")).toBe("active")
    expect(parse("deleted")).toBe("deleted")
  })

  it("treats an absent param as Semua", () => {
    expect(userSearchQuerySchema.parse({}).deleted_at).toBeUndefined()
  })

  it("drops an array or an unknown state", () => {
    expect(parse(["deleted"])).toBeUndefined()
    expect(parse("banana")).toBeUndefined()
  })
})
