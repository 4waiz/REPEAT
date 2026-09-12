/**
 * Minimal ESM resolve hook so the engine self-test can run the real
 * TypeScript sources under plain Node, with the same "@/" alias and
 * extensionless imports that Next.js resolves for us in the app.
 *
 *   node --experimental-strip-types --import ./scripts/alias-loader.mjs scripts/verify-engine.ts
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

const ROOT = process.cwd();

function firstExisting(base) {
  const candidates = [`${base}.ts`, `${base}.tsx`, base, path.join(base, 'index.ts')];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile());
}

export function resolve(specifier, context, nextResolve) {
  // "@/lib/x" -> "<root>/lib/x.ts"
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(path.join(ROOT, specifier.slice(2)));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }

  // "./taxonomy" -> "<dir>/taxonomy.ts"
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL?.startsWith('file:')
      ? path.dirname(fileURLToPath(context.parentURL))
      : ROOT;
    const hit = firstExisting(path.resolve(parentPath, specifier));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }

  return nextResolve(specifier, context);
}

// Self-register when used via --import.
register(import.meta.url, pathToFileURL('./'));
