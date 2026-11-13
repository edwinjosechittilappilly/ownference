import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const defaultConfigDir = () => process.env.OWNFERENCE_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'ownference');
export function normalizeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Origin must be an exact HTTP(S) or chrome-extension origin'); }
  const extension = url.protocol === 'chrome-extension:';
  if (!['http:', 'https:', 'chrome-extension:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== (extension ? '' : '/') || url.search || url.hash || value !== `${url.protocol}//${url.host}` || (extension && (url.port || !/^[a-p]{32}$/.test(url.hostname)))) throw new Error('Origin must be an exact HTTP(S) or chrome-extension origin');
  return value;
}
const digest = token => createHash('sha256').update(token).digest('hex');
export async function readGrants(dir = defaultConfigDir()) {
  try {
    const data = JSON.parse(await readFile(join(dir, 'grants.json'), 'utf8'));
    if (!Array.isArray(data)) throw new Error('Invalid grants file');
    return data;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function save(dir, grants) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  const tmp = join(dir, `.grants-${randomBytes(12).toString('hex')}`);
  await writeFile(tmp, JSON.stringify(grants) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(tmp, join(dir, 'grants.json'));
}
export async function grant(origin, dir = defaultConfigDir()) {
  origin = normalizeOrigin(origin);
  const token = randomBytes(32).toString('base64url');
  const grants = await readGrants(dir);
  await save(dir, [...grants.filter(g => g.origin !== origin), { origin, digest: digest(token) }]);
  return token;
}
export async function revoke(origin, dir = defaultConfigDir()) {
  origin = normalizeOrigin(origin);
  const grants = await readGrants(dir);
  const remaining = grants.filter(g => g.origin !== origin);
  if (remaining.length === grants.length) return false;
  await save(dir, remaining);
  return true;
}
export function authenticate(grants, token) {
  if (typeof token !== 'string' || token.length > 256) return null;
  const hash = Buffer.from(digest(token), 'hex');
  return grants.find(g => typeof g.digest === 'string' && /^[a-f0-9]{64}$/.test(g.digest) && timingSafeEqual(hash, Buffer.from(g.digest, 'hex'))) || null;
}
