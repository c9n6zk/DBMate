import { describe, it, expect } from 'vitest';
import { cn, escapeRegex } from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges Tailwind classes (last wins)', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

describe('escapeRegex', () => {
  it('escapes dots', () => {
    expect(escapeRegex('file.txt')).toBe('file\\.txt');
  });

  it('escapes brackets', () => {
    // '-' is not a regex special char outside character classes
    expect(escapeRegex('[a-z]')).toBe('\\[a-z\\]');
  });

  it('escapes parentheses', () => {
    expect(escapeRegex('fn()')).toBe('fn\\(\\)');
  });

  it('escapes asterisks and plus', () => {
    expect(escapeRegex('a*b+c')).toBe('a\\*b\\+c');
  });

  it('escapes question marks', () => {
    expect(escapeRegex('a?b')).toBe('a\\?b');
  });

  it('escapes pipes', () => {
    expect(escapeRegex('a|b')).toBe('a\\|b');
  });

  it('escapes backslashes', () => {
    expect(escapeRegex('a\\b')).toBe('a\\\\b');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeRegex('hello_world')).toBe('hello_world');
  });

  it('handles empty string', () => {
    expect(escapeRegex('')).toBe('');
  });

  it('makes escaped string safe for regex use', () => {
    const pattern = escapeRegex('users(id)');
    const regex = new RegExp(pattern);
    expect(regex.test('users(id)')).toBe(true);
    expect(regex.test('usersXid)')).toBe(false);
  });
});
