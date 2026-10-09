/**
 * Ed25519 public key (base64, 32 raw bytes) for verifying signed
 * license keys locally — mirrors VEILWRIGHT_LICENSE_PUBLIC_KEY in
 * veilwright-ai/veilwright-ai.php, same keypair (the matching
 * private key is not in either repo). Overridable via the
 * VEILWRIGHT_LICENSE_PUBLIC_KEY env var, checked first — no rebuild
 * needed to rotate it.
 */
const DEFAULT_LICENSE_PUBLIC_KEY = 'ciErUNlgeFIIqIp2ASTeHcBwWmIMa8fg/GxNDIM9NtM=';
export function resolveLicensePublicKey(env) {
    return env.VEILWRIGHT_LICENSE_PUBLIC_KEY ?? DEFAULT_LICENSE_PUBLIC_KEY;
}
//# sourceMappingURL=publicKey.js.map