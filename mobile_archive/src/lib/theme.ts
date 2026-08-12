// Monochrome palette matching the web app's luxury design language:
// paper background, ink text, hairline borders, muted status tints.

export const theme = {
  bg: "#F6F5F2",
  surface: "#FFFFFF",
  ink: "#1A1915",
  muted: "#75716A",
  line: "#E3E0D9",
  lineSoft: "#EDEBE5",
  ok: "#2E6B4F",
  okSoft: "#E8F0EC",
  warn: "#93641C",
  warnSoft: "#F5EDDE",
  danger: "#8C2B2B",
  dangerSoft: "#F4E6E6",
  scannerBg: "#141311",
} as const;

export const type = {
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.muted,
  },
  display: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: theme.ink,
  },
} as const;
