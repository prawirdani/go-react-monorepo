#!/usr/bin/env node
// Catalog hygiene report. Informational only — always exits 0.
//
// `check:messages` guards correctness (ICU validity + key parity) and is wired
// into the build. This one surfaces maintenance smells that should not fail a
// build: keys nothing references, text duplicated across keys, and strings
// that are identical in every locale (often legitimate, sometimes a missed
// translation).
//
// The unused-key scan deliberately includes `packages/schemas`: validation
// messages are emitted from there, so an app-only scan would report every
// `validation.*` key as dead.
//
// Usage: pnpm audit:messages
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import enApp from "../src/messages/en/app.ts"
import enCommon from "../src/messages/en/common.ts"
import enUi from "../src/messages/en/ui.ts"
import enValidation from "../src/messages/en/validation.ts"
import idApp from "../src/messages/id/app.ts"
import idCommon from "../src/messages/id/common.ts"
import idUi from "../src/messages/id/ui.ts"
import idValidation from "../src/messages/id/validation.ts"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

const catalogs = {
	en: { app: enApp, common: enCommon, ui: enUi, validation: enValidation },
	id: { app: idApp, common: idCommon, ui: idUi, validation: idValidation },
}

function flatten(value, prefix = "") {
	const out = {}
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key
		if (child && typeof child === "object" && !Array.isArray(child)) {
			Object.assign(out, flatten(child, path))
		} else {
			out[path] = child
		}
	}
	return out
}

const flat = Object.fromEntries(
	Object.entries(catalogs).map(([locale, catalog]) => [
		locale,
		flatten(catalog),
	]),
)
const keys = Object.keys(flat.en)

function walk(dir, acc = []) {
	for (const entry of readdirSync(dir)) {
		if (["node_modules", "dist", ".git", ".turbo"].includes(entry)) continue
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) walk(path, acc)
		else if (/\.(ts|tsx)$/.test(entry)) acc.push(path)
	}
	return acc
}

const sources = [
	join(ROOT, "apps/dashboard/src"),
	join(ROOT, "packages/ui/src"),
	join(ROOT, "packages/i18n/src"),
	join(ROOT, "packages/schemas/src"),
]
	.flatMap((dir) => walk(dir))
	.filter((path) => !path.includes("/messages/"))
const blob = sources.map((path) => readFileSync(path, "utf8")).join("\n")

// A key is reachable either fully qualified (`"app.nav.dashboard"`) or
// namespace-relative when the call site opens the namespace
// (`useTranslations("app")` + `t("nav.dashboard")`).
const unused = keys.filter((key) => {
	const namespace = key.split(".")[0]
	const relative = key.slice(namespace.length + 1)
	return !blob.includes(`"${key}"`) && !blob.includes(`"${relative}"`)
})

const byNamespace = {}
for (const key of keys) {
	const namespace = key.split(".")[0]
	byNamespace[namespace] = (byNamespace[namespace] ?? 0) + 1
}

console.log(`keys — en: ${keys.length}, id: ${Object.keys(flat.id).length}`)
console.log(`per namespace — ${JSON.stringify(byNamespace)}`)

console.log(`\nunused keys (${unused.length}):`)
for (const key of unused) {
	console.log(`  ${key} = "${String(flat.en[key]).slice(0, 60)}"`)
}

const byValue = {}
for (const key of keys) {
	const value = flat.en[key]
	if (typeof value !== "string" || value.length < 4) continue
	;(byValue[value] ??= []).push(key)
}
const duplicates = Object.entries(byValue).filter(([, ks]) => ks.length > 1)
console.log(`\nduplicate values in en (${duplicates.length}):`)
for (const [value, ks] of duplicates) {
	console.log(`  "${value.slice(0, 40)}" ×${ks.length} — ${ks.join(", ")}`)
}

const identical = keys.filter((key) => flat.en[key] === flat.id[key])
console.log(`\nidentical across locales (${identical.length}):`)
for (const key of identical) {
	console.log(`  ${key} = "${String(flat.en[key]).slice(0, 40)}"`)
}

console.log("\nreported, not enforced — run `pnpm check:messages` for the gate")
