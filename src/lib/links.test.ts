import { describe, expect, it } from 'vitest';
import { parseLinks, safeUrl } from './links';

describe('safeUrl', () => {
  it('accepts http and https', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeUrl('http://example.com')).toBe('http://example.com/');
  });
  it('rejects scripts, data URLs, relative and malformed input', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.test', '/relative', 'not a url', '', 'https://a.test/ b']) {
      expect(safeUrl(bad)).toBeNull();
    }
  });
});

describe('parseLinks', () => {
  it('separates valid and invalid lines', () => {
    const r = parseLinks('https://a.test\n\njavascript:x\n https://b.test ');
    expect(r.links).toEqual(['https://a.test/', 'https://b.test/']);
    expect(r.invalid).toEqual(['javascript:x']);
    expect(r.tooMany).toBe(false);
  });
  it('flags when more than 10 links are provided (REC-007)', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `https://example.test/${i}`).join('\n');
    const r = parseLinks(eleven);
    expect(r.links).toHaveLength(11);
    expect(r.tooMany).toBe(true);
  });
});
