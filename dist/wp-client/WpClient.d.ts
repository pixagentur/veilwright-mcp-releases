import { CircuitBreaker } from './CircuitBreaker.js';
import { type MultipartFile } from './multipart.js';
export interface WpClientCredentials {
    baseUrl: string;
    keyId: string;
    secret: string;
}
export interface ApiEnvelope<T> {
    success: boolean;
    data: T | null;
    meta: Record<string, unknown>;
    error: {
        code: string;
        message: string;
        details: unknown[];
    } | null;
}
/** Thrown for any non-success response from the WordPress API. */
export declare class WpApiError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status: number);
}
/**
 * HTTP client for the veilwright-ai REST API: signs every request
 * with HmacSigner, retries transient (5xx) failures with backoff,
 * and trips a per-instance CircuitBreaker after repeated failures so
 * an unreachable site isn't hammered. One instance per site.
 */
export declare class WpClient {
    private readonly credentials;
    private readonly signer;
    private readonly breaker;
    constructor(credentials: WpClientCredentials, breaker?: CircuitBreaker);
    request<T>(method: string, path: string, body?: unknown): Promise<T>;
    private doRequest;
    /**
     * Uploads a file as multipart/form-data (e.g. POST /media). The
     * body is built manually (see multipart.ts), but the signature
     * covers `canonicalMultipartBody()`, not these raw bytes — the
     * server can't read the raw multipart body at all (see that
     * function's docblock), so signing over it would never verify.
     */
    uploadFile<T>(path: string, fields: Record<string, string>, file: MultipartFile): Promise<T>;
    private doMultipartRequest;
    private parseEnvelope;
}
