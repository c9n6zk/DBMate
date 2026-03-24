/**
 * Robustly extract and parse JSON from AI response text.
 * Handles: markdown code blocks, truncated JSON, nested braces.
 */
export function extractJSON(text: string): Record<string, unknown> {
  // Strip markdown code blocks
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to repair
  }

  // Extract outermost { ... } with brace balancing
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in AI response');

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end !== -1) {
    // Found balanced JSON
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // continue to repair
    }
  }

  // JSON is likely truncated — attempt repair
  let truncated = end !== -1 ? cleaned.slice(start, end + 1) : cleaned.slice(start);

  // Remove trailing incomplete values (e.g., truncated string or number)
  truncated = truncated.replace(/,\s*"[^"]*$/, '');       // trailing incomplete key
  truncated = truncated.replace(/,\s*"[^"]*":\s*"[^"]*$/, ''); // trailing incomplete string value
  truncated = truncated.replace(/,\s*"[^"]*":\s*\S*$/, '');    // trailing incomplete value
  truncated = truncated.replace(/,\s*$/, '');              // trailing comma

  // Close open brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  escape = false;
  for (const ch of truncated) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  // Close unclosed strings
  if (inString) truncated += '"';

  // Close brackets/braces in correct order
  for (let i = 0; i < openBrackets; i++) truncated += ']';
  for (let i = 0; i < openBraces; i++) truncated += '}';

  try {
    return JSON.parse(truncated);
  } catch {
    throw new Error(`Failed to parse AI JSON response (len=${text.length})`);
  }
}
