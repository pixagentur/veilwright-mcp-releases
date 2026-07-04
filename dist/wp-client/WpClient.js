import { CircuitBreaker } from './CircuitBreaker.js';
import { HmacSigner } from './HmacSigner.js';
import { buildMultipartBody } from './multipart.js';
import { withRetry } from './retry.js';
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
            ...this.signer.buildHeaders(method, path, bodyStr, this.credentials.keyId, this.credentials.secret),
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
     * body is built manually (see multipart.ts) so it can be signed
     * over its exact bytes before being sent.
     */
    async uploadFile(path, fields, file) {
        if (!this.breaker.canAttempt()) {
            throw new WpApiError('VW_CIRCUIT_OPEN', 'Circuit breaker is open for this site.', 503);
        }
        const { body, contentType } = buildMultipartBody(fields, file);
        try {
            const result = await withRetry(() => this.doMultipartRequest(path, body, contentType), {
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
    async doMultipartRequest(path, body, contentType) {
        const headers = {
            ...this.signer.buildHeaders('POST', path, body, this.credentials.keyId, this.credentials.secret),
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
        const envelope = (await response.json());
        if (!envelope.success || envelope.error) {
            throw new WpApiError(envelope.error?.code ?? 'VW_UNKNOWN', envelope.error?.message ?? 'Unknown error', response.status);
        }
        return envelope.data;
    }
}
//# sourceMappingURL=WpClient.js.map