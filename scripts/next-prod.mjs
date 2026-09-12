#!/usr/bin/env node
/**
 * Production build / start wrapper.
 *
 * Forces production output into `.next-build` so it can never overwrite a
 * running dev server's `.next`. Doing that mid-demo corrupts the dev chunks
 * and the app starts returning MODULE_NOT_FOUND — which is exactly the sort
 * of self-inflicted failure a demo cannot afford.
 *
 * A wrapper rather than an inline env var because `VAR=x cmd` is not valid in
 * cmd.exe or PowerShell, and rather than NEXT_PHASE because that is not set
 * when next.config.mjs is evaluated.
 *
 *   node scripts/next-prod.mjs build
 *   node scripts/next-prod.mjs start
 */
import { spawn } from 'node:child_process';

const command = process.argv[2];
if (!['build', 'start'].includes(command)) {
  console.error('usage: node scripts/next-prod.mjs <build|start>');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', command, ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env: { ...process.env, NEXT_DIST_DIR: '.next-build' },
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
