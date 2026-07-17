/**
 * Team metadata for World Cup match markets: a flag (flagcdn ISO code) and a
 * brand color used for chart lines and the trade panel. Falls back gracefully
 * for any label not in the table.
 */
export interface TeamMeta {
  code: string; // flagcdn code, e.g. "fr" or "gb-eng"
  color: string; // hex, used for chart line + selected button
}

const TEAMS: Record<string, TeamMeta> = {
  Spain: { code: "es", color: "#c60b1e" },
  Argentina: { code: "ar", color: "#5b9bd5" },
  France: { code: "fr", color: "#1e3a8a" },
  England: { code: "gb-eng", color: "#cf142b" },
  Brazil: { code: "br", color: "#009c3b" },
  Germany: { code: "de", color: "#111111" },
  Portugal: { code: "pt", color: "#006600" },
  Netherlands: { code: "nl", color: "#f36c21" },
};

export function teamMeta(label: string): TeamMeta {
  return TEAMS[label] ?? { code: "un", color: "#6366f1" };
}

/** A PNG flag URL at one of flagcdn's supported widths. */
export function flagUrl(code: string, width: 40 | 80 | 160 | 320 = 80): string {
  return `https://flagcdn.com/w${width}/${code}.png`;
}
