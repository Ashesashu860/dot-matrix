// Remove dist/ without following symlinks (fs.rm unlinks links, never their targets).
import { rm } from 'node:fs/promises';
import path from 'node:path';

await rm(path.join(import.meta.dirname, '..', 'dist'), { recursive: true, force: true });
