/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#f4f0e6",
      "foreground": "#263b32",
      "border": "#d8d2c3",
      "card": "#fffcf4",
      "cardForeground": "#263b32",
      "popover": "#fffcf4",
      "popoverForeground": "#263b32",
      "primary": "#315c45",
      "primaryForeground": "#fffcf4",
      "secondary": "#e3e9dc",
      "secondaryForeground": "#263b32",
      "muted": "#e9e2d2",
      "mutedForeground": "#536457",
      "accent": "#a85032",
      "accentForeground": "#fffcf4",
      "destructive": "#963f35",
      "destructiveForeground": "#fffcf4",
      "input": "#d8d2c3",
      "ring": "#a85032",
      "chart1": "#315c45",
      "chart2": "#a85032",
      "chart3": "#80521f",
      "chart4": "#35694e",
      "chart5": "#963f35",
      "sidebar": "#e9e2d2",
      "sidebarForeground": "#263b32",
      "sidebarBorder": "#d8d2c3",
      "sidebarPrimary": "#315c45",
      "sidebarPrimaryForeground": "#fffcf4",
      "sidebarAccent": "#e3e9dc",
      "sidebarAccentForeground": "#263b32",
      "sidebarRing": "#a85032"
    },
    "dark": {
      "background": "#1e2b25",
      "foreground": "#f1ecdc",
      "border": "#48574a",
      "card": "#29382f",
      "cardForeground": "#f1ecdc",
      "popover": "#29382f",
      "popoverForeground": "#f1ecdc",
      "primary": "#b8d0ae",
      "primaryForeground": "#1e2b25",
      "secondary": "#39453a",
      "secondaryForeground": "#f1ecdc",
      "muted": "#39453a",
      "mutedForeground": "#bdc5b5",
      "accent": "#edaa83",
      "accentForeground": "#1e2b25",
      "destructive": "#f0a79a",
      "destructiveForeground": "#1e2b25",
      "input": "#48574a",
      "ring": "#f1b393",
      "chart1": "#b8d0ae",
      "chart2": "#edaa83",
      "chart3": "#edc58c",
      "chart4": "#abd0a9",
      "chart5": "#f0a79a",
      "sidebar": "#29382f",
      "sidebarForeground": "#f1ecdc",
      "sidebarBorder": "#48574a",
      "sidebarPrimary": "#b8d0ae",
      "sidebarPrimaryForeground": "#1e2b25",
      "sidebarAccent": "#39453a",
      "sidebarAccentForeground": "#f1ecdc",
      "sidebarRing": "#f1b393"
    }
  },
  "fontFamily": {
    "sans": [
      "Nunito Sans",
      "system-ui",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "SFMono-Regular",
      "Consolas",
      "Liberation Mono",
      "monospace"
    ]
  },
  "radius": "0.875rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
