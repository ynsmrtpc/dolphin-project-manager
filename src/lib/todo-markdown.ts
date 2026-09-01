export type ParsedTodo = {
  title: string;
  done: boolean;
  priority: "low" | "normal" | "high";
};

/**
 * Markdown listesinden gorev cikarir.
 * Once `- [ ]` / `- [x]` kutucuklarina bakar; hic yoksa duz madde isaretlerine duser.
 */
export function parseTodoMarkdown(markdown: string): ParsedTodo[] {
  const lines = markdown.split(/\r?\n/);
  const checkboxes: ParsedTodo[] = [];
  const bullets: ParsedTodo[] = [];

  for (const line of lines) {
    const checkbox = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (checkbox) {
      const title = cleanTitle(checkbox[2]);
      if (title) {
        checkboxes.push({
          title,
          done: checkbox[1].toLowerCase() === "x",
          priority: detectPriority(checkbox[2]),
        });
      }
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(?!\[)(.+?)\s*$/);
    if (bullet) {
      const title = cleanTitle(bullet[1]);
      if (title) {
        bullets.push({ title, done: false, priority: detectPriority(bullet[1]) });
      }
    }
  }

  return checkboxes.length > 0 ? checkboxes : bullets;
}

/** Markdown sussunu atip duz basliga cevirir. */
function cleanTitle(raw: string) {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[!\s]+/, "")
    // Basligin sonundaki oncelik isaretlerini (! veya "(low)") temizle.
    .replace(/\s*\((low|high|düşük|yüksek|p[0-3])\)\s*$/i, "")
    .replace(/\s*!{1,3}\s*$/, "")
    .trim()
    .slice(0, 300);
}

function detectPriority(raw: string): ParsedTodo["priority"] {
  const value = raw.toLocaleLowerCase("tr");
  if (
    /(^|\s)!{1,3}(\s|$)/.test(raw) ||
    /\b(urgent|acil|high|yüksek|p0|p1)\b/.test(value)
  ) {
    return "high";
  }
  if (/\b(low|düşük|nice to have|p3)\b/.test(value)) return "low";
  return "normal";
}
