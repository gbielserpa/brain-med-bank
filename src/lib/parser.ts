// Parses pasted Brazilian-style alternatives into A/B/C/D[/E] objects.
// Recognizes patterns like: "A)", "A.", "A:", "A -", "(A)", "a)", "[A]", etc.
export type ParsedAlt = { letter: string; text: string };

const LETTER_RE = /^\s*[\(\[]?\s*([a-eA-E])\s*[\)\]\.\-:\–—]\s+(.*)$/;

export function parseAlternatives(raw: string): ParsedAlt[] {
  if (!raw) return [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const results: ParsedAlt[] = [];
  let current: ParsedAlt | null = null;
  for (const line of lines) {
    const m = line.match(LETTER_RE);
    if (m) {
      if (current) results.push(current);
      current = { letter: m[1].toUpperCase(), text: m[2].trim() };
    } else if (current && line.trim()) {
      current.text += " " + line.trim();
    }
  }
  if (current) results.push(current);

  // Dedup by letter, keep order A→E
  const seen = new Set<string>();
  const ordered: ParsedAlt[] = [];
  for (const a of results) {
    if (!seen.has(a.letter)) {
      seen.add(a.letter);
      ordered.push(a);
    }
  }
  ordered.sort((a, b) => a.letter.localeCompare(b.letter));
  return ordered.slice(0, 5);
}
