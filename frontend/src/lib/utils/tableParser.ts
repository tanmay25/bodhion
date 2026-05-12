/**
 * Markdown table parser utilities.
 *
 * Used by StreamingResponse to split LLM output into text and table segments
 * so that table blocks can be rendered as interactive React components
 * (with optional chart toggle) rather than plain HTML.
 */

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Regex that matches a complete markdown GFM table:
 *   | Header | ... |
 *   | --- | --- |      ← separator row (dashes, colons, pipes, spaces only)
 *   | val | ... |
 *   ...
 *
 * Must be tested with `g` flag reset before each use (call resetTableRegex()).
 */
const TABLE_RE =
  /((?:\|[^\n]+\|\s*\n)+\|[\s\-:|]+\|\s*\n(?:\|[^\n]+\|\s*\n?)*)/g;

/** Reset regex state — always call before iterating with TABLE_RE */
function resetTableRegex() {
  TABLE_RE.lastIndex = 0;
}

// ── Segment types ─────────────────────────────────────────────────────────────

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'table'; content: string };

/**
 * Split `content` into alternating text/table segments.
 * Text segments use the existing marked+DOMPurify pipeline unchanged.
 * Table segments are passed to ChartFromTable for interactive rendering.
 *
 * Returns a single text segment when no tables are found (zero overhead path).
 */
export function splitIntoSegments(content: string): Segment[] {
  resetTableRegex();

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TABLE_RE.exec(content)) !== null) {
    // Text before the table
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'table', content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last table (or entire content if no tables)
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }];
}

/**
 * Returns true if the content contains at least one markdown table.
 * Fast check used to skip segmentation when unnecessary.
 */
export function hasMarkdownTable(content: string): boolean {
  resetTableRegex();
  const result = TABLE_RE.test(content);
  resetTableRegex(); // leave clean
  return result;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  // Strip leading/trailing `|` then split on `|`
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

/**
 * Parse a raw markdown table string into headers + rows.
 * Returns null if the table cannot be parsed (malformed).
 */
export function parseMarkdownTable(raw: string): ParsedTable | null {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 3) return null; // need header + separator + ≥1 data row

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  // lines[1] must be the separator
  if (!isSeparatorRow(lines[1])) return null;

  const rows = lines
    .slice(2)
    .map(parseRow)
    .filter((r) => r.length > 0);

  if (rows.length === 0) return null;

  return { headers, rows };
}

// ── Numeric helpers ───────────────────────────────────────────────────────────

/** Try to parse a cell value as a finite number. */
export function toNumber(value: string): number | null {
  // Strip common currency/percent symbols and commas before parsing
  const cleaned = value.replace(/[$€£¥,%]/g, '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isFinite(n) && cleaned.length > 0 ? n : null;
}

/** Returns indices of columns whose values are ALL numeric (ignoring header). */
export function numericColumnIndices(table: ParsedTable): number[] {
  return table.headers
    .map((_, ci) => ci)
    .filter((ci) =>
      table.rows.every((row) => toNumber(row[ci] ?? '') !== null),
    );
}
