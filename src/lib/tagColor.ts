export function normalizeTagLabel(tag: string | null | undefined) {
  const value = tag?.trim();
  return value && value.length > 0 ? value : "Untagged";
}

function hashTag(tag: string) {
  // cyrb53-inspired hash for better spread across small palettes.
  let h1 = 0xdeadbeef ^ tag.length;
  let h2 = 0x41c6ce57 ^ tag.length;
  for (let i = 0; i < tag.length; i++) {
    const ch = tag.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return ((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0;
}

const TAG_COLOR_SET = [
  // blue 1
  { softBg: "#E8F0FE", softText: "#174EA6", solidBg: "#4285F4", solidText: "#FFFFFF" },
  // blue 2
  { softBg: "#EAF2FF", softText: "#185ABC", solidBg: "#1A73E8", solidText: "#FFFFFF" },
  // teal
  { softBg: "#E6F4EA", softText: "#0B8043", solidBg: "#1AAE9F", solidText: "#FFFFFF" },
  // green 1
  { softBg: "#E8F5E9", softText: "#137333", solidBg: "#34A853", solidText: "#FFFFFF" },
  // green 2
  { softBg: "#E3F2E8", softText: "#0D652D", solidBg: "#0F9D58", solidText: "#FFFFFF" },
  // purple
  { softBg: "#F3E8FD", softText: "#6A1B9A", solidBg: "#A142F4", solidText: "#FFFFFF" },
  // pink
  { softBg: "#FCE8F3", softText: "#AD1457", solidBg: "#E91E63", solidText: "#FFFFFF" },
  // orange
  { softBg: "#FEEFE3", softText: "#B06000", solidBg: "#FB8C00", solidText: "#FFFFFF" },
  // yellow
  { softBg: "#FEF7E0", softText: "#8D6E00", solidBg: "#F9AB00", solidText: "#1F1F1F" },
  // red
  { softBg: "#FCE8E6", softText: "#C5221F", solidBg: "#EA4335", solidText: "#FFFFFF" },
  // rose
  { softBg: "#FDE7EE", softText: "#9E2A5E", solidBg: "#D5477A", solidText: "#FFFFFF" },
] as const;

export function getTagColorStyles(tag: string | null | undefined) {
  const label = normalizeTagLabel(tag);
  const selected = TAG_COLOR_SET[hashTag(label.toLowerCase()) % TAG_COLOR_SET.length]!;

  return {
    soft: {
      backgroundColor: selected.softBg,
      color: selected.softText,
    },
    solid: {
      backgroundColor: selected.solidBg,
      color: selected.solidText,
    },
    label,
  };
}
