// Firebase deploys `functions/dist` (see firebase.json). Write a package.json
// there with only runtime dependencies — no workspace:* links — and copy the
// per-project .env files.
import { copyFile, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = {
  name: 'dotsnatch-functions',
  private: true,
  main: 'index.cjs',
  engines: { node: '22' },
  dependencies: pkg.dependencies,
};
await writeFile(path.join(root, 'dist', 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of await readdir(root)) {
  if (file.startsWith('.env')) await copyFile(path.join(root, file), path.join(root, 'dist', file));
}
// Let the local emulator resolve firebase-functions/firebase-admin from dist.
// (node_modules is excluded from deploys; Cloud Build installs dependencies.)
await symlink('../node_modules', path.join(root, 'dist', 'node_modules'), 'dir').catch((e) => {
  if (e.code !== 'EEXIST') throw e;
});
console.log('wrote dist/package.json');
