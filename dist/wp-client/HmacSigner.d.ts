/**
 * Client-side counterpart to veilwright-ai's Auth\HmacVerifier — the
 * canonical string and signing-key derivation must match exactly:
 *
 *   canonical = METHOD \n PATH \n sha256(body) \n TIMESTAMP \n NONCE
 *   signingKey = sha256(secret)     (the same value the server stores as secret_hash)
 *   signature = hmac_sha256(canonical, signingKey)
 *
 * See veilwright-ai/src/Auth/HmacVerifier.php for the server side.
 */
export declare class HmacSigner {
    /**
     * body accepts Buffer as well as string so binary payloads (e.g.
     * multipart file uploads) are hashed over their exact bytes rather
     * than a lossy UTF-8 string conversion, which would corrupt
     * non-UTF-8-safe binary content and produce a signature the server
     * can never reproduce.
     */
    buildCanonicalString(method: string, path: string, body: string | Buffer, timestamp: string, nonce: string): string;
    sign(canonical: string, signingKey: string): string;
    /** Derives the HMAC signing key from the plaintext secret: sha256(secret). */
    signingKeyFrom(secret: string): string;
    generateNonce(): string;
    /** Builds the four X-Veilwright-* headers for a request. */
    buildHeaders(method: string, path: string, body: string | Buffer, keyId: string, secret: string): Record<string, string>;
}
