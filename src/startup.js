import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { constants } from 'node:fs';
import { access, chmod, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfigDir } from './config.js';
import { persistentNodePath } from './node-path.js';

const label = 'com.ownference.bridge';
const defaultSource = join(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const runLaunchctl = args => execFileAsync('/bin/launchctl', args);
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function settings(options) {
  const { platform = process.platform, homeDir = homedir(), nodePath = process.execPath,
    sourceRoot = defaultSource, uid = process.getuid?.(), launchctl = runLaunchctl,
    configDir = defaultConfigDir() } = options;
  if (platform !== 'darwin') throw new Error('Startup is only supported on macOS');
  if (![homeDir, nodePath, sourceRoot, configDir].every(path => typeof path === 'string' && isAbsolute(path))) throw new Error('Startup paths must be absolute');
  if (!Number.isInteger(uid) || uid < 0) throw new Error('Cannot determine the macOS user ID');
  const startupDir = join(homeDir, 'Library', 'Application Support', 'Ownference', 'startup');
  return { homeDir, nodePath, sourceRoot, uid, launchctl, configDir, startupDir,
    runtimeDir: join(startupDir, 'runtime'),
    plistPath: join(homeDir, 'Library', 'LaunchAgents', `${label}.plist`) };
}

async function exists(path) {
  try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function executable(path) {
  try {
    if (!(await stat(path)).isFile()) return false;
    await access(path, constants.X_OK);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return false;
    throw error;
  }
}
async function installed(s) {
  let content;
  try { content = await readFile(s.plistPath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  const encoded = content.match(/<key>ProgramArguments<\/key>\s*<array>\s*<string>([\s\S]*?)<\/string>/)?.[1];
  if (encoded === undefined) return false;
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  const nodePath = encoded.replace(/&(amp|lt|gt|quot|apos);/g, entity => entities[entity]);
  return isAbsolute(nodePath) && await executable(nodePath) && await exists(join(s.runtimeDir, 'src', 'cli.js'));
}
function inside(path, directory) {
  const rel = relative(directory, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
async function rejectManagedSource(s) {
  if (inside(s.sourceRoot, s.startupDir)) throw new Error('Startup source is inside the managed startup directory');
  try {
    if (inside(await realpath(s.sourceRoot), await realpath(s.startupDir))) {
      throw new Error('Startup source is inside the managed startup directory');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
async function loaded(s) {
  try { await s.launchctl(['print', `gui/${s.uid}/${label}`]); return true; }
  catch (error) { if (error.code === 113 || error.code === 3) return false; throw error; }
}
function plist(s) {
  const args = [s.nodePath, join(s.runtimeDir, 'src', 'cli.js'), 'serve', '--config-dir', s.configDir];
  const env = { HOME: s.homeDir, OWNFERENCE_MANAGED_STARTUP: '1' };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join('')}</array>\n<key>EnvironmentVariables</key><dict>${Object.entries(env).map(([key, value]) => `<key>${key}</key><string>${xml(value)}</string>`).join('')}</dict>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>\n</dict></plist>\n`;
}

export async function startupStatus(options = {}) {
  const s = settings(options);
  return { installed: await installed(s), loaded: await loaded(s), plistPath: s.plistPath, runtimeDir: s.runtimeDir };
}

export async function installStartup(options = {}) {
  const s = settings(options);
  s.nodePath = persistentNodePath(options.nodePath);
  await rejectManagedSource(s);
  if (await loaded(s)) await s.launchctl(['bootout', `gui/${s.uid}/${label}`]);
  let stage;
  let bootstrapAttempted = false;
  try {
    await mkdir(s.startupDir, { recursive: true, mode: 0o700 });
    await chmod(s.startupDir, 0o700);
    stage = await mkdtemp(join(s.startupDir, 'install-'));
    const runtime = join(stage, 'runtime');
    await mkdir(runtime, { mode: 0o700 });
    await cp(join(s.sourceRoot, 'src'), join(runtime, 'src'), { recursive: true });
    await writeFile(join(runtime, 'package.json'), '{"type":"module"}\n', { mode: 0o600 });
    const bin = join(s.sourceRoot, 'bin');
    if (await exists(bin)) await cp(bin, join(runtime, 'bin'), { recursive: true });
    const stagedPlist = join(stage, 'agent.plist');
    await writeFile(stagedPlist, plist(s), { mode: 0o600 });
    await chmod(stagedPlist, 0o600);
    await mkdir(dirname(s.plistPath), { recursive: true, mode: 0o700 });
    await rm(s.runtimeDir, { recursive: true, force: true });
    await rename(runtime, s.runtimeDir);
    await rename(stagedPlist, s.plistPath);
    bootstrapAttempted = true;
    await s.launchctl(['bootstrap', `gui/${s.uid}`, s.plistPath]);
    await rm(stage, { recursive: true, force: true });
  } catch (error) {
    const failures = [];
    if (bootstrapAttempted) {
      try { if (await loaded(s)) await s.launchctl(['bootout', `gui/${s.uid}/${label}`]); }
      catch (cleanupError) { failures.push(cleanupError); }
    }
    for (const path of [s.plistPath, s.runtimeDir, stage].filter(Boolean)) {
      try { await rm(path, { recursive: true, force: true }); }
      catch (cleanupError) { failures.push(cleanupError); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], `Startup installation failed: ${error.message}; cleanup failed`, { cause: error });
    throw error;
  }
  return { installed: true, loaded: true, plistPath: s.plistPath, runtimeDir: s.runtimeDir };
}

export async function uninstallStartup(options = {}) {
  const s = settings(options);
  if (await loaded(s)) await s.launchctl(['bootout', `gui/${s.uid}/${label}`]);
  await rm(s.plistPath, { force: true });
  await rm(s.startupDir, { recursive: true, force: true });
  return { installed: false, loaded: false, plistPath: s.plistPath, runtimeDir: s.runtimeDir };
}
