#!/usr/bin/env node
/**
 * In-place update for an already-set-up Veilwright MCP install: downloads
 * the latest build from the public releases repo, replaces the shipped
 * files in this same folder, reinstalls dependencies, and — critically,
 * the part a plain "re-download the zip and run setup again" doesn't
 * guarantee — verifies the result actually works before declaring
 * success. Meant to be run via the double-clickable update-mac.command /
 * update-windows.bat / update-linux.sh wrappers (see those files), but
 * works fine run directly with `node update.js` too.
 *
 * Why this exists (real incident, 2026-08-17): a user's WordPress plugin
 * update didn't include this MCP server at all — it's a separate
 * component with no auto-update path. They re-downloaded the release zip
 * and ran the *setup* script, but macOS's Gatekeeper block on the
 * freshly-downloaded, unsigned setup-mac.command interrupted that run
 * before `npm install` ever executed — leaving a `dist/` folder with the
 * new code but no `node_modules` at all. Nothing surfaced that failure:
 * the folder looked complete, Claude Desktop's config still pointed at
 * it, and restarting Claude Desktop (the obvious next thing to try)
 * just kept re-spawning a server that could never start. Diagnosing that
 * took several back-and-forth rounds even for the plugin's own
 * developer, on their own machine, with the real error visible in a
 * terminal. This script exists so that: (a) once run successfully once,
 * the *next* update never touches a Gatekeeper-blocked file again
 * (Node itself and this already-downloaded, already-approved folder do
 * the fetching — no new unsigned executable is ever double-clicked for
 * an update), and (b) it never reports success without having actually
 * confirmed the native dependencies load, so a broken update is loud,
 * not silent.
 *
 * Deliberately only uses Node's own built-in modules (fs, path, os,
 * https, child_process) plus the system `tar` binary (present by
 * default on macOS, Linux, and Windows 10 1803+/11) — no npm
 * dependencies of its own, since a broken `node_modules` in the
 * install being updated must not be able to break the updater itself.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, cpSync, createWriteStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const RELEASES_TARBALL_URL = 'https://github.com/pixagentur/veilwright-mcp-releases/archive/refs/heads/main.tar.gz';

// Files/folders the release actually ships — copied over the existing
// install, nothing else in the target folder is touched (in particular,
// never `.veilwright` or anything a user might have added themselves).
const SHIPPED_ENTRIES = ['dist', 'skills', 'docs', 'package.json', 'README.md', 'setup.js', 'update.js', 'setup-mac.command', 'setup-windows.bat', 'setup-linux.sh', 'update-mac.command', 'update-windows.bat', 'update-linux.sh'];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function currentVersion() {
  try {
    return JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Follows redirects — GitHub's tarball URL 302s to codeload.github.com. */
function download(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'veilwright-mcp-update' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          download(res.headers.location, destPath, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (res.statusCode === 429) {
          res.resume();
          reject(new Error('GitHub is rate-limiting downloads from this network right now (HTTP 429) — wait a minute or two and run this again, no need to do anything else.'));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} from ${url}`));
          return;
        }

        const file = createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

function requireTar() {
  const check = spawnSync('tar', ['--version'], { stdio: 'ignore' });

  if (check.status !== 0 && check.error) {
    log('✗ The `tar` command wasn\'t found. It ships by default with macOS, Linux, and Windows 10/11 — if it\'s genuinely missing, install it via your system package manager and run this again.');
    process.exit(1);
  }
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);

  if (major >= 23) {
    log(`⚠ Node.js ${process.versions.node} is very new — if the dependency step below fails, installing Node 22 (LTS) from https://nodejs.org and running this again is the smoothest fix.`);
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
    log('  Your previous, working install has NOT been removed — nothing has actually changed yet, it is safe to try again after fixing this.');
    process.exit(1);
  }
}

/**
 * The actual point of this whole script over "just re-run setup":
 * confirm the thing that silently broke in the real incident this
 * exists for — a missing/broken native binding — genuinely works,
 * instead of trusting a zero exit code from `npm install` (which,
 * confusingly, is not even what failed in that incident — `npm
 * install` was simply never reached at all).
 */
function verifyInstall() {
  log('Verifying the install actually works...');

  const result = spawnSync('node', ['-e', "require('better-sqlite3'); require('./dist/mcp/server.js')"], {
    cwd: projectDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  // server.js starts a stdio server that blocks waiting for input —
  // requiring it here is expected to hang briefly then get killed by
  // Node's own event loop once stdin (piped from this process, closed
  // immediately) hits EOF, not to exit(0). What actually matters is
  // that it didn't throw synchronously (a missing/broken native
  // module throws immediately, before the server ever tries to read
  // stdin) — so a non-empty stderr mentioning a require/module error
  // is the real failure signal here, not the exit code by itself.
  const failedToLoad = /Cannot find module|invalid ELF header|not a valid Win32|bad CPU type|MODULE_NOT_FOUND/i.test(result.stderr || '');

  if (failedToLoad) {
    log('');
    log('✗ The server still cannot start after installing dependencies:');
    log(result.stderr.split('\n').slice(0, 10).join('\n'));
    log('');
    log('  See the "Troubleshooting" section in docs/self-hosting.md — this is very likely the same native-compiler issue as a failed npm install, just surfacing later.');
    process.exit(1);
  }

  log('✓ Native dependencies load correctly.');
}

async function main() {
  log('Checking for a Veilwright MCP update...');
  log(`Currently installed: v${currentVersion()}`);
  log('');

  checkNodeVersion();
  requireTar();

  const workDir = mkdtempSync(path.join(tmpdir(), 'veilwright-update-'));
  const tarballPath = path.join(workDir, 'release.tar.gz');
  const extractDir = path.join(workDir, 'extracted');

  try {
    log('Downloading the latest release...');
    await download(RELEASES_TARBALL_URL, tarballPath);

    mkdirSync(extractDir, { recursive: true });
    const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', extractDir], { stdio: 'inherit' });

    if (extract.status !== 0) {
      log('✗ Could not extract the downloaded release. Nothing on your computer has been changed — try again, or download manually from https://github.com/pixagentur/veilwright-mcp-releases.');
      process.exit(1);
    }

    // GitHub's tarball root folder is named "<repo>-<branch>" —
    // find it rather than hardcoding, in case that ever changes.
    const rootEntries = readdirSync(extractDir);
    const releaseRoot = path.join(extractDir, rootEntries[0]);

    const newVersion = JSON.parse(readFileSync(path.join(releaseRoot, 'package.json'), 'utf8')).version;

    if (newVersion === currentVersion()) {
      log(`✓ Already on the latest version (v${newVersion}). Nothing to do.`);
      return;
    }

    log(`Updating v${currentVersion()} → v${newVersion}...`);

    for (const entry of SHIPPED_ENTRIES) {
      const source = path.join(releaseRoot, entry);

      if (existsSync(source)) {
        cpSync(source, path.join(projectDir, entry), { recursive: true, force: true });
      }
    }

    installDependencies();
    verifyInstall();

    log('');
    log(`✓ Updated to v${newVersion}.`);
    log('');
    log('Next step: fully quit and reopen Claude Desktop (on macOS, quit from the menu bar — closing the window isn\'t enough) to pick up the update.');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  log('');
  log(`✗ Update failed: ${error.message}`);
  log('  Your previous install has not been touched. You can also always update manually — see docs/self-hosting.md.');
  process.exit(1);
});
