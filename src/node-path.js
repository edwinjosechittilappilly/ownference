import { accessSync, constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export function executableNode(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || /[\r\n]/.test(path)) return false;
  try { accessSync(path, constants.X_OK); return true; } catch { return false; }
}

export function persistentNodePath(explicit) {
  if (explicit !== undefined) {
    if (!executableNode(explicit)) throw new Error('Node path must be absolute and executable');
    return explicit;
  }
  const cellar = process.execPath.match(/^(.*)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/);
  if (cellar) {
    const stable = join(cellar[1], 'opt', cellar[2], 'bin', 'node');
    if (executableNode(stable)) return stable;
  }
  if (!executableNode(process.execPath)) throw new Error('Node path must be absolute and executable');
  return process.execPath;
}
