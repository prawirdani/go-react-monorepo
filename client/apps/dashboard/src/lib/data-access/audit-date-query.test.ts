import { type APIClient, AuditAPI } from "@repo/api"
import { auditSearchQuerySchema } from "@repo/schemas/audit"
import { describe, expect, it } from "vitest"

/** Captured-path stub, so the test asserts on what the API actually sent. */
function makeAPI() {
  const calls: string[] = []
  const client = {
    Queryable: async (path: string) => {
      calls.push(path)
      return { data: [], meta: {} }
    },
  } as unknown as APIClient
  return { calls, api: new AuditAPI(client) }
}

const query = (input: Record<string, string>) =>
  auditSearchQuerySchema.parse(input)

describe("audit date search query", () => {
  it("keeps bare calendar days and a valid zone", () => {
    const parsed = auditSearchQuerySchema.parse({
      from: "2026-09-17",
      to: "2026-09-21",
      tz: "Asia/Jakarta",
    })

    expect(parsed.from).toBe("2026-09-17")
    expect(parsed.to).toBe("2026-09-21")
    expect(parsed.tz).toBe("Asia/Jakarta")
  })

  it("drops a timestamp bound — the regression that silently disabled the filter", () => {
    const parsed = auditSearchQuerySchema.parse({
      from: "2026-08-31T17:00:00.000Z",
    })

    expect(parsed.from).toBe("")
  })

  it("drops an unknown zone instead of throwing", () => {
    expect(auditSearchQuerySchema.parse({ tz: "Not/AZone" }).tz).toBe("")
  })

  it("treats an empty zone as empty", () => {
    expect(auditSearchQuerySchema.parse({ tz: "" }).tz).toBe("")
  })
})

describe("AuditAPI.listAuditEntry date params", () => {
  it("sends tz alongside a from/to range", async () => {
    const { calls, api } = makeAPI()

    await api.listAuditEntry(
      query({ from: "2026-09-17", to: "2026-09-21", tz: "Asia/Jakarta" }),
    )

    const path = calls[0]
    expect(path).toContain("tz=Asia%2FJakarta")
    expect(path).toContain("from=2026-09-17")
    expect(path).toContain("to=2026-09-21")
  })

  it("omits tz when there is no date bound", async () => {
    const { calls, api } = makeAPI()

    await api.listAuditEntry(query({ tz: "Asia/Jakarta" }))

    expect(calls[0]).not.toContain("tz=")
  })

  it("sends date and drops from/to when a single day is set", async () => {
    const { calls, api } = makeAPI()

    await api.listAuditEntry(query({ date: "2026-09-17", tz: "Asia/Jakarta" }))

    const path = calls[0]
    expect(path).toContain("date=2026-09-17")
    expect(path).not.toContain("from=")
    expect(path).not.toContain("to=")
  })
})
