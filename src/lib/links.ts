/** Returns a normalised http(s) URL, or null if the input is not a safe external link. */
export function safeUrl(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 2048 || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Parses one-link-per-line text. Returns valid links and the lines that were rejected. */
export function parseLinks(text: string): { links: string[]; invalid: string[] } {
  const links: string[] = [];
  const invalid: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const url = safeUrl(line);
    if (url) links.push(url);
    else invalid.push(line);
  }
  return { links, invalid };
}
