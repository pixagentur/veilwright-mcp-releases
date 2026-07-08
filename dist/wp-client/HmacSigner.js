import { createHash, createHmac, randomBytes } from 'node:crypto';
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
export class HmacSigner {
    /**
     * body accepts Buffer as well as string so binary payloads (e.g.
     * multipart file uploads) are hashed over their exact bytes rather
     * than a lossy UTF-8 string conversion, which would corrupt
     * non-UTF-8-safe binary content and produce a signature the server
     * can never reproduce.
     */
    buildCanonicalString(method, path, body, timestamp, nonce) {
        const bodyBuffer = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
        const bodyHash = createHash('sha256').update(bodyBuffer).digest('hex');
        return [method.toUpperCase(), path, bodyHash, timestamp, nonce].join('\n');
    }
    sign(canonical, signingKey) {
        return createHmac('sha256', signingKey).update(canonical, 'utf8').digest('hex');
    }
    /** Derives the HMAC signing key from the plaintext secret: sha256(secret). */
    signingKeyFrom(secret) {
        return createHash('sha256').update(secret, 'utf8').digest('hex');
    }
    generateNonce() {
        return randomBytes(16).toString('hex');
    }
    /** Builds the four X-Veilwright-* headers for a request. */
    buildHeaders(method, path, body, keyId, secret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = this.generateNonce();
        const canonical = this.buildCanonicalString(method, path, body, timestamp, nonce);
        const signature = this.sign(canonical, this.signingKeyFrom(secret));
        return {
            'X-Veilwright-Key': keyId,
            'X-Veilwright-Timestamp': timestamp,
            'X-Veilwright-Nonce': nonce,
            'X-Veilwright-Signature': signature,
        };
    }
}
//# sourceMappingURL=HmacSigner.js.map