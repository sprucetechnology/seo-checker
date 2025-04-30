// File and directory utility functions

export function ensureOutputDir() {
  try {
    Deno.mkdirSync('output', { recursive: true });
  } catch (_) {}
} 