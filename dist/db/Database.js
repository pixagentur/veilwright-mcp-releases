import Database from 'better-sqlite3';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT,
  plugins TEXT NOT NULL,
  wp_version TEXT,
  elementor_version TEXT,
  key_id TEXT NOT NULL,
  health_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);

CREATE TABLE IF NOT EXISTS site_keys (
  site_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  rotated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_keys_tenant ON site_keys(tenant_id);

CREATE TABLE IF NOT EXISTS oidc_models (
  model_name TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  grant_id TEXT,
  user_code TEXT,
  uid TEXT,
  expires_at INTEGER,
  consumed_at INTEGER,
  PRIMARY KEY (model_name, id)
);
CREATE INDEX IF NOT EXISTS idx_oidc_grant ON oidc_models(grant_id);
CREATE INDEX IF NOT EXISTS idx_oidc_usercode ON oidc_models(user_code);
CREATE INDEX IF NOT EXISTS idx_oidc_uid ON oidc_models(uid);
`;
/**
 * Opens (creating if needed) the single SQLite file backing every
 * persistent piece of the hosted MCP server: accounts, sites, site
 * credentials, and the OAuth provider's own state (oidc_models).
 * Chosen over Postgres for the VPS deployment because it needs no
 * separate DB service to install/secure/back up — one file, `sqlite3
 * .backup` or a plain file copy is the entire backup story. Swapping
 * to Postgres later only touches this file and the Sqlite*Repository
 * classes; every port (SiteRepository, UserRepository, ...) stays
 * the same.
 *
 * Not unit tested here (opens a real file/`:memory:` handle via
 * better-sqlite3); this needs to run against the actually-installed
 * better-sqlite3 build, which this environment can't execute — see
 * README's "Verification gaps" section.
 */
export function openDatabase(path) {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA);
    return db;
}
//# sourceMappingURL=Database.js.map