import { CircuitBreaker } from './CircuitBreaker.js';
import { HmacSigner } from './HmacSigner.js';
import { buildMultipartBody, canonicalMultipartBody } from './multipart.js';
import { withRetry } from './retry.js';
function isWpNativeError(value) {
    return typeof value === 'object' && value !== null && 'code' in value && 'message' in value && !('success' in value);
}
/**
 * The signature must cover WP's REST *route* (what `$request->get_route()`
 * returns server-side, e.g. `/veilwright/v1/system`), not the physical
 * request path this client fetches (`/wp-json/veilwright/v1/system?type=...`) —
 * those differ by the `/wp-json` prefix, and AuthMiddleware signs
 * against the route. Every call site here passes the full `/wp-json/...`
 * path (needed for the actual HTTP request), so it's stripped just for
 * signing rather than requiring every caller to track two path forms.
 *
 * `get_route()` also never includes a query string (real bug found
 * live: `elementorTemplate_list({ type: ... })` always failed with
 * "Ungültige Anfrage-Signatur" — every other call site here has no
 * query string, so this went unnoticed until the first tool that
 * needed one) — strip it here too, rather than requiring every call
 * site to pass a query-string-free path just for signing.
 */
function signaturePath(path) {
    const withoutPrefix = path.replace(/^\/wp-json(?=\/|$)/, '');
    const queryIndex = withoutPrefix.indexOf('?');
    return queryIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, queryIndex);
}
/** Thrown for any non-success response from the WordPress API. */
export class WpApiError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'WpApiError';
    }
}
/**
 * HTTP client for the veilwright-ai REST API: signs every request
 * with HmacSigner, retries transient (5xx) failures with backoff,
 * and trips a per-instance CircuitBreaker after repeated failures so
 * an unreachable site isn't hammered. One instance per site.
 */
export class WpClient {
    credentials;
    signer = new HmacSigner();
    breaker;
    constructor(credentials, breaker) {
        this.credentials = credentials;
        this.breaker = breaker ?? new CircuitBreaker();
    }
    async request(method, path, body = null) {
        if (!this.breaker.canAttempt()) {
            throw new WpApiError('VW_CIRCUIT_OPEN', 'Circuit breaker is open for this site.', 503);
        }
        const bodyStr = body === null ? '' : JSON.stringify(body);
        try {
            const result = await withRetry(() => this.doRequest(method, path, bodyStr), {
                attempts: 3,
                baseDelayMs: 250,
                isRetryable: (error) => error instanceof WpApiError && error.status >= 500,
            });
            this.breaker.recordSuccess();
            return result;
        }
        catch (error) {
            this.breaker.recordFailure();
            throw error;
        }
    }
    async doRequest(method, path, bodyStr) {
        const headers = {
            ...this.signer.buildHeaders(method, signaturePath(path), bodyStr, this.credentials.keyId, this.credentials.secret),
            'Content-Type': 'application/json',
        };
        const response = await fetch(`${this.credentials.baseUrl}${path}`, {
            method,
            headers,
            body: bodyStr === '' ? undefined : bodyStr,
        });
        return this.parseEnvelope(response);
    }
    /**
     * Uploads a file as multipart/form-data (e.g. POST /media). The
     * body is built manually (see multipart.ts), but the signature
     * covers `canonicalMultipartBody()`, not these raw bytes — the
     * server can't read the raw multipart body at all (see that
     * function's docblock), so signing over it would never verify.
     */
    async uploadFile(path, fields, file) {
        if (!this.breaker.canAttempt()) {
            throw new WpApiError('VW_CIRCUIT_OPEN', 'Circuit breaker is open for this site.', 503);
        }
        const { body, contentType } = buildMultipartBody(fields, file);
        const signatureBody = canonicalMultipartBody(fields, file);
        try {
            const result = await withRetry(() => this.doMultipartRequest(path, body, contentType, signatureBody), {
                attempts: 3,
                baseDelayMs: 250,
                isRetryable: (error) => error instanceof WpApiError && error.status >= 500,
            });
            this.breaker.recordSuccess();
            return result;
        }
        catch (error) {
            this.breaker.recordFailure();
            throw error;
        }
    }
    async doMultipartRequest(path, body, contentType, signatureBody) {
        const headers = {
            ...this.signer.buildHeaders('POST', signaturePath(path), signatureBody, this.credentials.keyId, this.credentials.secret),
            'Content-Type': contentType,
        };
        const response = await fetch(`${this.credentials.baseUrl}${path}`, {
            method: 'POST',
            headers,
            // Buffer is structurally a Uint8Array at runtime, but @types/node's
            // Buffer type doesn't satisfy lib.dom's BodyInit overloads directly —
            // an explicit Uint8Array view avoids that mismatch without an unsafe cast.
            body: new Uint8Array(body),
        });
        return this.parseEnvelope(response);
    }
    async parseEnvelope(response) {
        const body = await response.json();
        if (isWpNativeError(body)) {
            throw new WpApiError(body.code, body.message, response.status);
        }
        const envelope = body;
        if (!envelope.success || envelope.error) {
            throw new WpApiError(envelope.error?.code ?? 'VW_UNKNOWN', envelope.error?.message ?? 'Unknown error', response.status);
        }
        return envelope.data;
    }
}
//# sourceMappingURL=WpClient.js.map