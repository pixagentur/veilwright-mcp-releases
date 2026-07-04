# Running Veilwright MCP on your own computer

This is the standard way to use Veilwright AI: the MCP server runs locally on your machine, started automatically by Claude Desktop. Nothing is hosted for you, nothing to pay for beyond the plugin itself, and your WordPress site's credentials never leave your computer.

You need:

- A WordPress site with the **Veilwright AI** plugin active, and an API key created (WP-admin → Veilwright AI → create a key).
- **Claude Desktop** installed, with a Claude account.
- About 10 minutes.

## 1. Install Node.js

Veilwright MCP needs Node.js — **install version 22 (LTS)**, not the newest "Current" version. A dependency (`better-sqlite3`) ships ready-to-use builds for LTS releases but not always for the very latest one, so picking Current can force a slow (and sometimes broken) from-source compile for no benefit.

- **macOS**: download the LTS installer from [nodejs.org](https://nodejs.org) — the site defaults to the LTS version, that's the right one. With Homebrew, use `brew install node@22` specifically, **not** plain `brew install node` (that installs the latest version, which is what causes the compiler error below).
- **Windows**: download the LTS installer from [nodejs.org](https://nodejs.org), run it, accept the defaults.
- **Linux**: use your distribution's package manager (check it offers Node 22), or [nvm](https://github.com/nvm-sh/nvm) with `nvm install 22`.

Check it worked — open a terminal (macOS: Terminal.app, Windows: PowerShell) and run:

```bash
node --version
```

You should see `v22` (or at least `v20`; avoid `v23`/`v24`+ for now).

## 2. Get the Veilwright MCP server files

Download from [github.com/pixagentur/veilwright-mcp-releases](https://github.com/pixagentur/veilwright-mcp-releases) — green **Code → Download ZIP** button, no GitHub account needed. Unzip it and note where you put it. Example: `~/veilwright-mcp` (macOS/Linux) or `C:\veilwright-mcp` (Windows).

This is a ready-to-run build (no TypeScript source, nothing to compile) — the same thing a paid tier would provide, just published automatically on every release.

## 3. Run the setup — no terminal typing needed

Inside the unzipped folder, run the setup for your OS:

- **macOS**: double-click `setup-mac.command`. It will be blocked the first time — **this is expected, see the note right below, don't skip it.**
- **Windows**: double-click **`setup-windows.bat`**. If "Windows protected your PC" appears, click **More info → Run anyway** (same idea as the macOS note below — an unsigned file downloaded from the internet, not a problem with the file itself).
- **Linux**: double-click **`setup-linux.sh`** if your file manager runs it, otherwise `./setup-linux.sh` in a terminal.

> **macOS: the first attempt *will* say "Apple could not verify... is free of malware" — this is expected, here's how to get past it (only needed once):**
> 1. Double-click `setup-mac.command`. You'll see the block dialog with only "Move to Trash" / "Done" — **click Done**, not Move to Trash.
> 2. Open **System Settings → Privacy & Security**, scroll down. You'll see a line mentioning `setup-mac.command` was blocked, with an **Open Anyway** button next to it — click that.
> 3. Enter your Mac password (or Touch ID) if asked.
> 4. Double-click `setup-mac.command` again — this time a dialog with an actual **Open** button appears. Click it.
>
> (On some macOS versions, right-click → Open offers this same "Open" button directly without needing System Settings — worth trying first, but if you only see "Move to Trash"/"Done" there too, the System Settings route above always works.)

A window opens showing progress — you don't type anything into it. It installs the few dependencies Veilwright MCP needs, generates a vault key (the thing that encrypts your WordPress site's API secret on disk — running setup again later reuses the same key instead of generating a new one, so nothing already registered breaks), and writes the right entry into Claude Desktop's config automatically, merging with whatever's already there rather than overwriting it. When it's done, it tells you to restart Claude Desktop and what to do next.

If it fails, it's almost always the `better-sqlite3` compiler issue — see Troubleshooting below; the fix is the same either way.

<details>
<summary>Prefer doing it manually, or on a system without a double-click option? (click to expand)</summary>

In a terminal, inside that folder:

```bash
cd path/to/veilwright-mcp
npm install --omit=dev
```

Generate a vault key (this encrypts your WordPress site's API secret on disk — save it somewhere safe, a password manager is fine):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Find Claude Desktop's config file — **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`; **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`; **Linux**: `~/.config/Claude/claude_desktop_config.json` — and add a `veilwright` entry under `mcpServers` (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "veilwright": {
      "command": "node",
      "args": ["/absolute/path/to/veilwright-mcp/dist/mcp/server.js"],
      "env": {
        "VEILWRIGHT_VAULT_KEY": "paste-your-64-char-key-here"
      }
    }
  }
}
```

If the file already has other `mcpServers` entries, add `"veilwright": { ... }` alongside them (don't duplicate the outer `{ "mcpServers": { ... } }`). Use the full, absolute path to `dist/mcp/server.js` — on Windows, escape backslashes or use forward slashes: `"C:/veilwright-mcp/dist/mcp/server.js"`.

</details>

## 4. Restart Claude Desktop

Fully quit and reopen it. Veilwright should now show up as a connected tool (check Claude Desktop's settings/connectors list, or just ask it something that needs it).

## 5. Connect your WordPress site

In WP-admin → Veilwright AI, create an API key if you haven't already — you'll get a **Key ID** and a **Secret** shown once, and a ready-to-paste connect message right there (also available any time afterwards on the plugin's **Connect** tab). On a paid plan, also enter your license key on the same plugin's **License** page in WP-admin (this is where it's assigned to that domain — not something you configure in Claude Desktop). The message looks like:

> Add my WordPress site: https://your-site.com, key ID xxx, secret yyy

Paste it into a chat with Claude — it uses the `site.add` tool to store it (encrypted, locally, using your vault key from step 3). From then on you can say things like "select my site" and "create a landing page from this HTML".

### Working with more than one site

You can register several sites this way. If you're actively going back and forth between two of them — especially in two separate Claude Desktop chat windows at once — it's safest to say which one you mean each time ("on my-site.com, create a page..."), rather than relying only on "select my site" from an earlier message. Claude can pass the specific site along with each request, so it won't accidentally act on the wrong one even if another open conversation switched sites in between.

## 6. (Optional) Install the workflow skill

**Nothing to install for this to work** — the core workflow rules (resolve a domain to the right site, pick the right page tool, publish drafts, ask before guessing on Theme Builder conditions) ship inside the MCP server itself and are sent to Claude automatically every time it connects. Updating `veilwright-mcp` (step 2's download) is enough to get improvements here; there's no separate skill file to re-upload and no way to end up on a stale copy.

The `skills/veilwright-workflow.zip` in the folder you downloaded is optional, supplementary detail for Elementor widget/Fluent-Forms edge cases the server's own reference resources (`elementor-widgets`, `fluent-forms`) already expose on demand — most people don't need to install it. If you want it anyway: Claude Desktop → **Settings → Customize → Skills → Upload skill** → select the zip. Unlike the server's own instructions/resources, this copy is a snapshot: re-upload it after an update if you want the latest version.

## Where your data lives

Everything — your registered site(s), their encrypted API secrets — is in one file: `~/.veilwright/veilwright.sqlite3` (or wherever `VEILWRIGHT_DB_PATH` points, if you set it). Back this up if you want to move to a new computer; there's nothing else to migrate.

## Troubleshooting

- **Claude Desktop doesn't show the tool at all**: check the JSON is valid (a trailing comma is the usual culprit — use a JSON validator), and that the path in `args` is correct and absolute.
- **"VEILWRIGHT_VAULT_KEY environment variable is not set"**: the `env` block in the config is missing or misspelled — re-run the setup script, or check step 3's manual instructions again.
- **Nothing happens after "restart Claude Desktop"**: on some setups Claude Desktop needs to be quit from the system tray/menu bar, not just the window closed.
- **Setup fails, or `npm install` fails, on `better-sqlite3` with `fatal error: 'climits' file not found` (macOS)**: your Xcode Command Line Tools are installed but broken or out of date — very common after a macOS update. Fix:
  ```bash
  xcode-select -p   # confirm it's installed at all
  sudo rm -rf /Library/Developer/CommandLineTools
  xcode-select --install
  ```
  Confirm the popup, wait for it to finish installing, then re-run the setup script (or `npm install --omit=dev`). If you have full Xcode.app instead of just the Command Line Tools, point to that instead: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`. Also double-check step 1 — Node 22 LTS avoids needing this compile at all in most cases.
- **Setup fails on `better-sqlite3` for another reason (any OS)**: it needs a C++ compiler to build its native binding if no ready-made build matches your Node version. macOS: `xcode-select --install` (see above if that alone doesn't work). Windows: install "Desktop development with C++" via the Visual Studio Build Tools installer. Linux: `sudo apt install build-essential python3` (or your distro's equivalent).

## Multiple computers

Repeat steps 1–4 on each machine. Each has its own local `veilwright.sqlite3`, so site registrations don't sync between them — re-add your site(s) (step 5) on the second machine.
