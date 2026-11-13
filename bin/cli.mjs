#!/usr/bin/env node
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const skillSrc = path.join(root, 'skill');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const DEFAULT_TARGET = path.join(os.homedir(), '.agents', 'skills', 'web-ai-search');

const HELP = `web-ai-search ${pkg.version}

Usage:
  npx web-ai-search install [options]     Install the skill (default command)
  npx web-ai-search doctor                Check local prerequisites
  npx web-ai-search --help | --version

Options:
  --target <dir>      Skill install directory (default: ~/.agents/skills/web-ai-search)
  --force             Replace an existing installation (removes stale files)

The CLI only copies files on this machine. It never reads browser cookies,
never contacts AI sites, and never uploads anything.
`;

function parseArgs(argv) {
  const o = { cmd: 'install', target: null, force: false, unknown: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'install' || a === 'doctor') o.cmd = a;
    else if (a === '--target') o.target = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--help' || a === '-h') o.cmd = 'help';
    else if (a === '--version' || a === '-v') o.cmd = 'version';
    else o.unknown = a;
  }
  return o;
}

async function isNonEmpty(dir) {
  if (!existsSync(dir)) return false;
  try { return (await readdir(dir)).length > 0; } catch { return false; }
}

async function install(o) {
  const target = path.resolve(o.target || DEFAULT_TARGET);
  if (await isNonEmpty(target) && !o.force) {
    console.error(`Target already exists and is not empty:\n  ${target}\nRe-run with --force to overwrite.`);
    return 1;
  }
  if (o.force && existsSync(target)) await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(skillSrc, target, { recursive: true, force: true });
  console.log(`Installed web-ai-search skill to:\n  ${target}`);

  console.log('\nNext steps:');
  console.log('  1. Log in to the AI sites in ego lite; the site list lives in <skill>/scripts/ego_sites.json.');
  console.log('  2. Read <skill>/SKILL.md and <skill>/references/ego-lite.md.');
  console.log('  3. Optional: python <skill>/scripts/ensure_proxy.py --check-only');
  return 0;
}

function doctor() {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  add('node', process.version, process.version);
  add('skill payload', existsSync(path.join(skillSrc, 'SKILL.md')), skillSrc);
  add('installed skill', existsSync(DEFAULT_TARGET), DEFAULT_TARGET);
  for (const [name, cmd, args] of [
    ['python', 'python', ['--version']],
    ['ego-browser', 'ego-browser', ['--version']],
  ]) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 8000 });
    add(name, r.status === 0, r.status === 0 ? (r.stdout || '').trim().slice(0, 80) : 'not found in PATH (optional)');
  }
  add('platform', true, `${process.platform} / ${process.arch}`);
  console.log(JSON.stringify({ version: pkg.version, checks }, null, 2));
  return 0;
}

const o = parseArgs(process.argv.slice(2));
let code = 0;
if (o.unknown) { console.error(`Unknown argument: ${o.unknown}\n\n${HELP}`); code = 1; }
else if (o.cmd === 'help') console.log(HELP);
else if (o.cmd === 'version') console.log(pkg.version);
else if (o.cmd === 'doctor') code = doctor();
else code = await install(o);
process.exitCode = code;
