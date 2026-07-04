#!/usr/bin/env node
/**
 * One-shot setup for Veilwright MCP: installs runtime dependencies,
 * generates (or reuses) the vault key, and writes/merges the
 * `veilwright` entry into Claude Desktop's config — the parts of
 * docs/self-hosting.md steps 3-5 that involved manually running
 * commands and hand-editing JSON. Meant to be run via the
 * double-clickable setup-mac.command / setup-windows.bat wrappers
 * (see those files), but works fine run directly with `node setup.js`
 * too.
 *
 * Deliberately built with only Node's own built-in modules (fs, path,
 * os, crypto, child_process) — no dependencies of its own, since it
 * has to run *before* `npm install` has necessarily succeeded.
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const projectDir = __dirname;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function claudeConfigPath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  }

  // Linux and anything else Claude Desktop might run on.
  return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);

  if (major < 20) {
    log(`⚠ Node.js ${process.versions.node} found — Veilwright MCP needs Node 20 or newer. Please install Node 22 (LTS) from https://nodejs.org and run this again.`);
    process.exit(1);
  }

  if (major >= 23) {
    log(`⚠ Node.js ${process.versions.node} is very new — some dependencies (better-sqlite3) may not have a ready-to-use build for it yet, which can make the next step fail needing a C++ compiler. If it does, the smoothest fix is installing Node 22 (LTS) instead: https://nodejs.org`);
  }
}

function installDependencies() {
  log('Installing dependencies (this can take a minute)...');

  const result = spawnSync('npm', ['install', '--omit=dev'], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: os.platform() === 'win32',
  });

  if (result.status !== 0) {
    log('');
    log('✗ npm install failed. This is almost always better-sqlite3 needing a C++ compiler it couldn\'t find.');
    log('  See the "Troubleshooting" section in docs/self-hosting.md for the exact fix for your OS.');
    process.exit(1);
  }
}

function readExistingConfig(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    log(`⚠ ${configPath} exists but isn't valid JSON — leaving it untouched. Add the "veilwright" entry manually, see docs/self-hosting.md step 5.`);
    process.exit(1);
  }
}

function writeClaudeConfig() {
  const configPath = claudeConfigPath();
  const config = readExistingConfig(configPath);

  config.mcpServers = config.mcpServers || {};

  // Reuse an existing vault key if this has been run before — a new
  // one would make any already-registered site's stored (encrypted)
  // credentials unreadable.
  const existingKey = config.mcpServers.veilwright?.env?.VEILWRIGHT_VAULT_KEY;
  const vaultKey = existingKey || randomBytes(32).toString('hex');

  config.mcpServers.veilwright = {
    command: 'node',
    args: [path.join(projectDir, 'dist', 'mcp', 'server.js')],
    env: { VEILWRIGHT_VAULT_KEY: vaultKey },
  };

  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  log(`✓ Wrote ${configPath}`);

  return { isNewKey: !existingKey };
}

function main() {
  log('Setting up Veilwright MCP...');
  log('');

  checkNodeVersion();
  installDependencies();
  const { isNewKey } = writeClaudeConfig();

  log('');
  log('✓ Done.');
  log('');
  log('Next steps:');
  log('1. Fully quit and reopen Claude Desktop (on macOS, quit from the menu bar — closing the window isn\'t enough).');
  log('2. Check Veilwright shows up as a connected tool.');
  log('3. In your WordPress site\'s admin: Veilwright AI → Connect tab, and paste the message shown there into a chat with Claude.');

  if (isNewKey) {
    log('');
    log('A new vault key was generated and saved into Claude Desktop\'s config — you don\'t need to do anything with it yourself.');
  }
}

main();
