import { describe, it, expect } from 'vitest';
import { extractJSON } from '../extract-json';

describe('extractJSON - edge cases', () => {
  it('handles deeply nested objects (10+ levels)', () => {
    let json = '{"a":';
    for (let i = 0; i < 10; i++) json += '{"b":';
    json += '1';
    for (let i = 0; i < 10; i++) json += '}';
    json += '}';
    const result = extractJSON(json);
    expect(result).toHaveProperty('a');
  });

  it('handles unicode characters in values', () => {
    const input = '{"name": "Jáky Dániel", "city": "Budapest 🏙️"}';
    const result = extractJSON(input);
    expect(result.name).toBe('Jáky Dániel');
  });

  it('handles empty object', () => {
    expect(extractJSON('{}')).toEqual({});
  });

  it('handles object with only whitespace after text', () => {
    const input = 'Here is the result: {"ok": true}   \n\n';
    expect(extractJSON(input)).toEqual({ ok: true });
  });

  it('handles escaped backslashes in strings', () => {
    const input = '{"path": "C:\\\\Users\\\\admin"}';
    const result = extractJSON(input);
    expect(result.path).toBe('C:\\Users\\admin');
  });

  it('handles multiple JSON objects in text (picks first)', () => {
    const input = 'First: {"a": 1} Second: {"b": 2}';
    const result = extractJSON(input);
    expect(result).toEqual({ a: 1 });
  });

  it('handles numbers as values correctly', () => {
    const input = '{"int": 42, "float": 3.14, "neg": -1, "sci": 1e5}';
    const result = extractJSON(input);
    expect(result.int).toBe(42);
    expect(result.float).toBe(3.14);
    expect(result.neg).toBe(-1);
    expect(result.sci).toBe(100000);
  });

  it('handles boolean and null values', () => {
    const input = '{"a": true, "b": false, "c": null}';
    const result = extractJSON(input);
    expect(result.a).toBe(true);
    expect(result.b).toBe(false);
    expect(result.c).toBeNull();
  });

  it('handles AI response with markdown headings around JSON', () => {
    const input = `## Analysis Result

Here is my analysis:

\`\`\`json
{"score": 85, "grade": "B+"}
\`\`\`

### Notes
Some extra text here.`;
    const result = extractJSON(input);
    expect(result.score).toBe(85);
    expect(result.grade).toBe('B+');
  });

  it('handles truncated string value with escaped quote', () => {
    // JSON truncated mid-value with escaped quote before truncation
    const input = '{"a": 1, "b": "hello \\"world';
    const result = extractJSON(input);
    expect(result.a).toBe(1);
  });

  it('handles large arrays in objects', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const input = JSON.stringify({ data: arr });
    const result = extractJSON(input);
    expect((result.data as number[]).length).toBe(100);
  });
});
