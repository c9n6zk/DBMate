import { describe, it, expect } from 'vitest';
import { extractJSON } from '../extract-json';

describe('extractJSON', () => {
  describe('direct JSON parsing', () => {
    it('parses plain JSON object', () => {
      const result = extractJSON('{"key": "value", "num": 42}');
      expect(result).toEqual({ key: 'value', num: 42 });
    });

    it('parses JSON with whitespace', () => {
      const result = extractJSON('  {"a": 1}  ');
      expect(result).toEqual({ a: 1 });
    });

    it('parses nested objects', () => {
      const result = extractJSON('{"a": {"b": {"c": 1}}}');
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    it('parses arrays within objects', () => {
      const result = extractJSON('{"items": [1, 2, 3]}');
      expect(result).toEqual({ items: [1, 2, 3] });
    });
  });

  describe('markdown code block stripping', () => {
    it('strips ```json wrapper', () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(extractJSON(input)).toEqual({ key: 'value' });
    });

    it('strips ``` wrapper without language tag', () => {
      const input = '```\n{"key": "value"}\n```';
      expect(extractJSON(input)).toEqual({ key: 'value' });
    });

    it('strips ```json with no newline before closing', () => {
      const input = '```json\n{"key": "value"}```';
      expect(extractJSON(input)).toEqual({ key: 'value' });
    });
  });

  describe('brace-balanced extraction', () => {
    it('extracts JSON from surrounding text', () => {
      const input = 'Here is the result: {"score": 85} hope this helps!';
      expect(extractJSON(input)).toEqual({ score: 85 });
    });

    it('handles nested braces correctly', () => {
      const input = 'Result: {"a": {"b": 1}, "c": 2} done';
      expect(extractJSON(input)).toEqual({ a: { b: 1 }, c: 2 });
    });

    it('handles strings containing braces', () => {
      const input = '{"text": "a {b} c"}';
      expect(extractJSON(input)).toEqual({ text: 'a {b} c' });
    });

    it('handles escaped quotes in strings', () => {
      const input = '{"text": "she said \\"hello\\""}';
      expect(extractJSON(input)).toEqual({ text: 'she said "hello"' });
    });
  });

  describe('truncated JSON repair', () => {
    it('closes unclosed braces', () => {
      const input = '{"a": 1, "b": {"c": 2}';
      expect(extractJSON(input)).toEqual({ a: 1, b: { c: 2 } });
    });

    it('closes unclosed brackets and braces', () => {
      // This input has balanced braces via brace-tracking but invalid JSON inside
      const input = '{"a": 1, "b": [1, 2';
      const result = extractJSON(input);
      expect(result).toHaveProperty('a', 1);
    });

    it('removes trailing incomplete key', () => {
      const input = '{"a": 1, "incomp';
      const result = extractJSON(input);
      expect(result).toEqual({ a: 1 });
    });

    it('removes trailing incomplete string value', () => {
      const input = '{"a": 1, "b": "incomplete val';
      const result = extractJSON(input);
      expect(result).toEqual({ a: 1 });
    });

    it('removes trailing comma in truncated JSON', () => {
      // Trailing comma after truncation (brace not found, triggers repair)
      const input = 'Prefix {"a": 1, "b": 2, "c": ';
      const result = extractJSON(input);
      expect(result).toHaveProperty('a', 1);
      expect(result).toHaveProperty('b', 2);
    });
  });

  describe('error handling', () => {
    it('throws on empty string', () => {
      expect(() => extractJSON('')).toThrow('No JSON object found');
    });

    it('throws on text without JSON', () => {
      expect(() => extractJSON('just plain text')).toThrow('No JSON object found');
    });

    it('throws on pure array input (no object)', () => {
      // extractJSON looks for '{', '[1,2,3]' has no '{' so throws
      expect(() => extractJSON('just an array [1, 2, 3] here')).toThrow('No JSON object found');
    });
  });

  describe('real-world AI response patterns', () => {
    it('extracts from typical AI chat response', () => {
      const input = `Here's the analysis:

\`\`\`json
{
  "score": 75,
  "issues": [
    {"title": "Missing PK", "severity": "critical"}
  ],
  "summary": "Schema needs improvement"
}
\`\`\`

Let me know if you need more details.`;
      const result = extractJSON(input);
      expect(result).toEqual({
        score: 75,
        issues: [{ title: 'Missing PK', severity: 'critical' }],
        summary: 'Schema needs improvement',
      });
    });

    it('handles AI response with text before JSON', () => {
      const input = `Based on the schema analysis, here is my assessment:
{"normalization": 20, "issues": [], "summary": "Good schema"}`;
      const result = extractJSON(input);
      expect(result).toEqual({
        normalization: 20,
        issues: [],
        summary: 'Good schema',
      });
    });
  });
});
