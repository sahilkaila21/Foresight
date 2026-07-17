/** Market categories, shared by the create form, filter chips, and validation. */
export const CATEGORIES = [
  "World Cup",
  "Politics",
  "Crypto",
  "Sports",
  "Economics",
  "Culture",
  "Science",
  "Tech",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/** Emoji glyph shown next to a category in nav tabs and market cards. */
export const CATEGORY_ICONS: Record<Category, string> = {
  "World Cup": "⚽",
  Politics: "🏛️",
  Crypto: "₿",
  Sports: "🏆",
  Economics: "📈",
  Culture: "🎬",
  Science: "🔬",
  Tech: "💻",
  Other: "🔮",
};
