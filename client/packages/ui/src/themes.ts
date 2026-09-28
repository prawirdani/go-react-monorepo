export type ThemeId = "graphite" | "ledger" | "ember"

export type ThemeDefinition = {
  id: ThemeId
  label: string
  hint: string
}

/**
 * The three worlds of the console. Order is the picker order.
 * `hint` is a single short English line naming the palette's character.
 */
export const themes: ThemeDefinition[] = [
  {
    id: "graphite",
    label: "Graphite",
    hint: "Dark instrument console, cool blue accent.",
  },
  {
    id: "ledger",
    label: "Ledger",
    hint: "Cool paper, ink rules, soft corners.",
  },
  {
    id: "ember",
    label: "Ember",
    hint: "Warm near-black steel, ember accent, Chivo.",
  },
]

export const DEFAULT_THEME: ThemeId = "graphite"

export const THEME_IDS: readonly ThemeId[] = themes.map((theme) => theme.id)
