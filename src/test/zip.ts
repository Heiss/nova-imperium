// Reads the ZIP of the error log download (issue #126) in tests: every file
// as its JSON lines; each file is empty or ends with a newline.
import { strFromU8, unzipSync } from 'fflate';
import { expect } from 'vitest';

export function unzipLines(zip: Uint8Array): Record<string, unknown[]> {
  const files = unzipSync(zip);
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => {
      const text = strFromU8(data);
      expect(text === '' || text.endsWith('\n')).toBe(true);
      return [
        name,
        text
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as unknown),
      ];
    }),
  );
}
