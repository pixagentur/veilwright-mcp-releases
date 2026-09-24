import Database from 'better-sqlite3';
/**
 * Derived from the default export's constructor type rather than a
 * named `Database` type import — @types/better-sqlite3's exact named
 * exports have shifted across versions, and this form (`InstanceType
 * <typeof Database>`) only depends on the default export existing,
 * which is stable.
 */
export type SqliteDatabase = InstanceType<typeof Database>;
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
export declare function openDatabase(path: string): SqliteDatabase;
