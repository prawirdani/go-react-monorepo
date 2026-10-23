export type ThemeId = "graphite" | "sea-glass" | "ember"

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
    hint: "Cool instrument console, Geist.",
  },
  {
    id: "sea-glass",
    label: "Sea Glass",
    hint: "Muted sea mist, quiet accent, Onest.",
  },
  {
    id: "ember",
    label: "Ember",
    hint: "Warm steel, ember accent, Bricolage.",
  },
]

export const DEFAULT_THEME: ThemeId = "graphite"

export const THEME_IDS: readonly ThemeId[] = themes.map((theme) => theme.id)
