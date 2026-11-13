import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installStartup, startupStatus, uninstallStartup } from '../src/startup.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ownmode-startup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homeDir = join(root, 'home & user'), sourceRoot = join(root, 'source');
  await mkdir(join(sourceRoot, 'src'), { recursive: true });
  await mkdir(join(sourceRoot, 'bin'));
  await writeFile(join(sourceRoot, 'src', 'cli.js'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  await writeFile(join(sourceRoot, 'bin', 'ownmode-apple'), 'apple helper');
  let running = false;
  const calls = [];
  const launchctl = async args => {
    calls.push(args);
    if (args[0] === 'print' && !running) throw Object.assign(new Error('not loaded'), { code: 113 });
    if (args[0] === 'bootstrap') running = true;
    if (args[0] === 'bootout') running = false;
  };
  const options = { platform: 'darwin', homeDir, sourceRoot, nodePath: process.execPath, uid: 501, configDir: join(root, 'config & grants'), launchctl };
  return { root, options, calls };
}

test('opt-in install creates a durable restricted LaunchAgent and uninstall removes it', async t => {
  const { options, calls } = await fixture(t);
  assert.deepEqual([ (await startupStatus(options)).installed, (await startupStatus(options)).loaded ], [false, false]);
  const installed = await installStartup(options);
  assert.equal(installed.loaded, true);
  const content = await readFile(installed.plistPath, 'utf8');
  assert.match(content, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(content, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>/);
  assert.match(content, /<key>OWNMODE_MANAGED_STARTUP<\/key><string>1<\/string>/);
  assert.ok(content.includes(options.nodePath));
  assert.ok(content.includes('home &amp; user'));
  assert.ok(content.includes('config &amp; grants'));
  assert.ok(content.includes('<string>--config-dir</string>'));
  assert.equal((await stat(installed.plistPath)).mode & 0o777, 0o600);
  assert.equal((await stat(join(installed.runtimeDir, '..'))).mode & 0o777, 0o700);
  assert.equal(await readFile(join(installed.runtimeDir, 'bin', 'ownmode-apple'), 'utf8'), 'apple helper');
  await rm(options.sourceRoot, { recursive: true });
  const result = await promisify(execFile)(options.nodePath, [join(installed.runtimeDir, 'src', 'cli.js'), 'serve', '--config-dir', options.configDir]);
  assert.deepEqual(JSON.parse(result.stdout), ['serve', '--config-dir', options.configDir]);
  assert.deepEqual([ (await startupStatus(options)).installed, (await startupStatus(options)).loaded ], [true, true]);
  await uninstallStartup(options);
  assert.deepEqual([ (await startupStatus(options)).installed, (await startupStatus(options)).loaded ], [false, false]);
  assert.ok(calls.some(args => args[0] === 'bootstrap' && args[1] === 'gui/501' && args[2] === installed.plistPath));
  assert.ok(calls.some(args => args[0] === 'bootout' && args[1] === 'gui/501/com.ownmode.bridge'));
  await uninstallStartup(options);
});

test('reinstall replaces the running agent and refreshes its runtime', async t => {
  const { options, calls } = await fixture(t);
  const first = await installStartup(options);
  await writeFile(join(options.sourceRoot, 'src', 'cli.js'), 'updated');
  await installStartup(options);
  assert.equal(await readFile(join(first.runtimeDir, 'src', 'cli.js'), 'utf8'), 'updated');
  assert.deepEqual(calls.map(args => args[0]), ['print', 'bootstrap', 'print', 'bootout', 'bootstrap']);
});

test('unsupported systems, invalid paths and launchctl failures are reported', async t => {
  const { options } = await fixture(t);
  await assert.rejects(installStartup({ ...options, platform: 'linux' }), /only supported on macOS/);
  await assert.rejects(installStartup({ ...options, nodePath: 'node' }), /absolute/);
  await assert.rejects(installStartup({ ...options, configDir: 'relative' }), /absolute/);
  await assert.rejects(startupStatus({ ...options, uid: undefined, platform: 'darwin', launchctl: async () => { throw new Error('launchctl failed'); } }), /launchctl failed/);
  await installStartup(options);
  await assert.rejects(uninstallStartup({ ...options, launchctl: async args => { if (args[0] === 'bootout') throw new Error('permission denied'); } }), /permission denied/);
  assert.equal((await startupStatus(options)).installed, true);
});

test('copy failure removes the old installation and leaves status uninstalled', async t => {
  const { options } = await fixture(t);
  const installed = await installStartup(options);
  await rm(join(options.sourceRoot, 'src'), { recursive: true });
  await assert.rejects(installStartup(options));
  assert.deepEqual([(await startupStatus(options)).installed, (await startupStatus(options)).loaded], [false, false]);
  await assert.rejects(stat(installed.plistPath), { code: 'ENOENT' });
  await assert.rejects(stat(installed.runtimeDir), { code: 'ENOENT' });
});

test('bootstrap failure removes the staged installation and leaves status uninstalled', async t => {
  const { options } = await fixture(t);
  const failBootstrap = async args => {
    if (args[0] === 'print') throw Object.assign(new Error('not loaded'), { code: 113 });
    if (args[0] === 'bootstrap') throw new Error('bootstrap failed');
  };
  await assert.rejects(installStartup({ ...options, launchctl: failBootstrap }), /bootstrap failed/);
  const status = await startupStatus(options);
  assert.equal(status.installed, false);
  assert.equal(status.loaded, false);
  await assert.rejects(stat(status.plistPath), { code: 'ENOENT' });
  await assert.rejects(stat(status.runtimeDir), { code: 'ENOENT' });
});

test('failed replacement bootstrap removes both the previous and replacement installations', async t => {
  const { options } = await fixture(t);
  const previous = await installStartup(options);
  const launchctl = async args => {
    if (args[0] === 'bootstrap') throw new Error('replacement bootstrap failed');
    return options.launchctl(args);
  };
  await assert.rejects(installStartup({ ...options, launchctl }), /replacement bootstrap failed/);
  const status = await startupStatus(options);
  assert.equal(status.installed, false);
  assert.equal(status.loaded, false);
  await assert.rejects(stat(previous.plistPath), { code: 'ENOENT' });
  await assert.rejects(stat(previous.runtimeDir), { code: 'ENOENT' });
});

test('rejects source inside the managed runtime without damaging the installation', async t => {
  const { root, options } = await fixture(t);
  const installed = await installStartup(options);
  await assert.rejects(installStartup({ ...options, sourceRoot: installed.runtimeDir }), /source.*inside/i);
  const link = join(root, 'runtime-link');
  await symlink(installed.runtimeDir, link);
  await assert.rejects(installStartup({ ...options, sourceRoot: link }), /source.*inside/i);
  assert.equal((await startupStatus(options)).installed, true);
  assert.equal(await readFile(join(installed.runtimeDir, 'bin', 'ownmode-apple'), 'utf8'), 'apple helper');
});

test('status checks the executable recorded in the installed plist', async t => {
  const { root, options } = await fixture(t);
  const nodePath = join(root, 'node & runtime');
  await writeFile(nodePath, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  await installStartup({ ...options, nodePath });
  assert.equal((await startupStatus(options)).installed, true);
  await chmod(nodePath, 0o600);
  assert.equal((await startupStatus(options)).installed, false);
  await assert.rejects(installStartup({ ...options, nodePath }), /executable/);
  await chmod(nodePath, 0o700);
  assert.equal((await startupStatus(options)).installed, true);
  await rm(nodePath);
  assert.equal((await startupStatus(options)).installed, false);
});
