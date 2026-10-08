import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair } from 'jose';
/**
 * Loads the RSA signing key oidc-provider uses for JWT access
 * tokens, generating and persisting one on first run. Must survive
 * restarts: a fresh key on every boot would invalidate every
 * previously issued access/refresh token and break signature
 * verification for tokens already cached by MCP resource-server
 * middleware. File is written with 0600 permissions — it is a
 * private key.
 */
export async function loadOrCreateJwks(path) {
    if (existsSync(path)) {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = await exportJWK(privateKey);
    jwk.kid = randomUUID();
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    const file = { keys: [jwk] };
    writeFileSync(path, JSON.stringify(file, null, 2), { mode: 0o600 });
    return file;
}
//# sourceMappingURL=jwks.js.map