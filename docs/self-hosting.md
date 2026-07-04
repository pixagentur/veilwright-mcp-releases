# Running Veilwright MCP on your own computer

This is the standard way to use Veilwright AI: the MCP server runs locally on your machine, started automatically by Claude Desktop. Nothing is hosted for you, nothing to pay for beyond the plugin itself, and your WordPress site's credentials never leave your computer.

You need:

- A WordPress site with the **Veilwright AI** plugin active, and an API key created (WP-admin → Veilwright AI → create a key).
- **Claude Desktop** installed, with a Claude account.
- About 10 minutes.

## 1. Install Node.js

Veilwright MCP needs Node.js 20 or newer.

- **macOS**: download the installer from [nodejs.org](https://nodejs.org) (choose the LTS version), or `brew install node` if you use Homebrew.
- **Windows**: download the installer from [nodejs.org](https://nodejs.org), run it, accept the defaults.
- **Linux**: use your distribution's package manager, or [nvm](https://github.com/nvm-sh/nvm) if it's not on a recent-enough version.

Check it worked — open a terminal (macOS: Terminal.app, Windows: PowerShell) and run:

```bash
node --version
```

You should see `v20` or higher.

## 2. Get the Veilwright MCP server files

Download from [github.com/pixagentur/veilwright-mcp-releases](https://github.com/pixagentur/veilwright-mcp-releases) — green **Code → Download ZIP** button, no GitHub account needed. Unzip it and note where you put it — you'll need the path later. Example: `~/veilwright-mcp` (macOS/Linux) or `C:\veilwright-mcp` (Windows).

This is a ready-to-run build (no TypeScript source, nothing to compile) — the same thing a paid tier would provide, just published automatically on every release.

## 3. Install its dependencies

In a terminal, go into that folder and run:

```bash
cd path/to/veilwright-mcp
npm install --omit=dev
```

This downloads the few libraries it needs to run. Only needs to be done once (or again after an update). If this step errors out on `better-sqlite3` needing a compiler, install your platform's build tools first (macOS: `xcode-select --install`; Windows: "Desktop development with C++" from the Visual Studio Build Tools installer; Linux: `build-essential` + `python3`), then retry.

## 4. Generate your vault key

This key encrypts your WordPress site's API secret on your disk. Generate one and save it somewhere safe (a password manager is fine):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

You'll get a 64-character string. Copy it.

## 5. Tell Claude Desktop about it

Find Claude Desktop's config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Open it in a text editor (create it if it doesn't exist) and add a `veilwright` entry under `mcpServers`. If the file is empty, use this:

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

If the file already has other `mcpServers` entries, just add `"veilwright": { ... }` alongside them (don't duplicate the outer `{ "mcpServers": { ... } }`).

- Use the **full, absolute path** to `dist/mcp/server.js` inside the folder from step 2/3 — not a relative path.
- On Windows, escape backslashes or use forward slashes: `"C:/veilwright-mcp/dist/mcp/server.js"`.

## 6. Restart Claude Desktop

Fully quit and reopen it. Veilwright should now show up as a connected tool (check Claude Desktop's settings/connectors list, or just ask it something that needs it).

## 7. Connect your WordPress site

In WP-admin → Veilwright AI, create an API key if you haven't already — you'll get a **Key ID** and a **Secret** shown once. On a paid plan, also enter your license key on the same plugin's **License** page in WP-admin (this is where it's assigned to that domain — not something you configure in Claude Desktop). Then, in a chat with Claude:

> Add my WordPress site: https://your-site.com, key ID xxx, secret yyy

Claude uses the `site.add` tool to store it (encrypted, locally, using your vault key from step 4). From then on you can say things like "select my site" and "create a landing page from this HTML".

### Working with more than one site

You can register several sites this way. If you're actively going back and forth between two of them — especially in two separate Claude Desktop chat windows at once — it's safest to say which one you mean each time ("on my-site.com, create a page..."), rather than relying only on "select my site" from an earlier message. Claude can pass the specific site along with each request, so it won't accidentally act on the wrong one even if another open conversation switched sites in between.

## 8. (Recommended) Install the workflow skill

This makes the multi-site behaviour above automatic instead of something you have to remember to say — it teaches Claude to resolve a domain you mention to the right site every time and pick the right page tool (plain content vs. a real Elementor design build).

In Claude Desktop: **Settings → Customize → Skills → Upload skill**, and select `skills/veilwright-workflow.zip` from the folder you downloaded in step 2. Once uploaded, you don't need to do anything else — Claude uses it automatically whenever it's relevant.

## Where your data lives

Everything — your registered site(s), their encrypted API secrets — is in one file: `~/.veilwright/veilwright.sqlite3` (or wherever `VEILWRIGHT_DB_PATH` points, if you set it). Back this up if you want to move to a new computer; there's nothing else to migrate.

## Troubleshooting

- **Claude Desktop doesn't show the tool at all**: check the JSON is valid (a trailing comma is the usual culprit — use a JSON validator), and that the path in `args` is correct and absolute.
- **"VEILWRIGHT_VAULT_KEY environment variable is not set"**: the `env` block in the config is missing or misspelled — check step 5 again.
- **Nothing happens after "restart Claude Desktop"**: on some setups Claude Desktop needs to be quit from the system tray/menu bar, not just the window closed.

## Multiple computers

Repeat steps 1–6 on each machine. Each has its own local `veilwright.sqlite3`, so site registrations don't sync between them — re-add your site(s) (step 7) on the second machine.
