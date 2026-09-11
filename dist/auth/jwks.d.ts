import { type JWK } from 'jose';
export interface JwksFile {
    keys: JWK[];
}
/**
 * Loads the RSA signing key oidc-provider uses for JWT access
 * tokens, generating and persisting one on first run. Must survive
 * restarts: a fresh key on every boot would invalidate every
 * previously issued access/refresh token and break signature
 * verification for tokens already cached by MCP resource-server
 * middleware. File is written with 0600 permissions — it is a
 * private key.
 */
export declare function loadOrCreateJwks(path: string): Promise<JwksFile>;
