export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1).trim());
}
