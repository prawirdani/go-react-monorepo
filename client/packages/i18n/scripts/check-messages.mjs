#!/usr/bin/env node
// Validates the message catalogs:
//   1. every message parses as ICU (use-intl has no build-time ICU check),
//   2. `en` and `id` expose identical key sets.
// Exits non-zero on any problem.
//
// NOTE: Node resolves ESM specifiers literally, so this script imports the
// namespace files directly (with .ts extensions) rather than the barrel
// indexes, which use extensionless imports for bundler resolution.
import IntlMessageFormat from "intl-messageformat"
import enApp from "../src/messages/en/app.ts"
import enCommon from "../src/messages/en/common.ts"
import enUi from "../src/messages/en/ui.ts"
import enValidation from "../src/messages/en/validation.ts"
import idApp from "../src/messages/id/app.ts"
import idCommon from "../src/messages/id/common.ts"
import idUi from "../src/messages/id/ui.ts"
import idValidation from "../src/messages/id/validation.ts"

const catalogs = {
	en: {
		app: enApp,
		common: enCommon,
		ui: enUi,
		validation: enValidation,
	},
	id: {
		app: idApp,
		common: idCommon,
		ui: idUi,
		validation: idValidation,
	},
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

const failures = []

// 1. ICU validity
for (const [locale, messages] of Object.entries(flat)) {
	for (const [key, message] of Object.entries(messages)) {
		if (typeof message !== "string") continue
		try {
			new IntlMessageFormat(message, locale)
		} catch (error) {
			failures.push(
				`ICU ERROR [${locale}] ${key}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}

// 2. Key parity
const enKeys = new Set(Object.keys(flat.en))
const idKeys = new Set(Object.keys(flat.id))
for (const key of enKeys) {
	if (!idKeys.has(key)) failures.push(`MISSING in id: ${key}`)
}
for (const key of idKeys) {
	if (!enKeys.has(key)) failures.push(`MISSING in en: ${key}`)
}

for (const failure of failures) console.error(failure)

console.log(
	`keys — en: ${enKeys.size}, id: ${idKeys.size} | messages checked: ${enKeys.size + idKeys.size}`,
)
if (failures.length > 0) {
	console.error(`FAILED: ${failures.length} problem(s)`)
	process.exit(1)
}
console.log("OK: ICU valid and key sets match")
