export interface MultipartFile {
    fieldName: string;
    filename: string;
    contentType: string;
    data: Buffer;
}
/**
 * Canonical "body" for a multipart/form-data upload, signed instead
 * of the raw multipart-encoded bytes.
 *
 * The server (PHP) can never read `php://input` for a
 * `multipart/form-data` POST — a hard PHP limitation (the SAPI
 * consumes it while populating $_POST/$_FILES), not a WordPress one
 * — so it can't reproduce a hash of the exact bytes this client
 * sends. Both sides instead build this same deterministic string
 * from the plain fields plus a hash of the file's actual bytes:
 * sorted `key=value` lines, then `file=<sha256 of the file content>`.
 * See veilwright-ai/src/Auth/HmacVerifier.php's
 * `canonicalMultipartBody()` for the server-side counterpart — the
 * two must stay in lockstep.
 */
export declare function canonicalMultipartBody(fields: Record<string, string>, file: MultipartFile): string;
/**
 * Builds a multipart/form-data body manually rather than delegating
 * to fetch's automatic FormData serialization — its bytes aren't
 * available until fetch serializes the request internally, which is
 * too late to construct the actual request payload predictably (the
 * signature itself is computed over `canonicalMultipartBody()`
 * above, not these bytes — see its docblock for why). A fixed
 * boundary can be injected for deterministic tests.
 */
export declare function buildMultipartBody(fields: Record<string, string>, file: MultipartFile, boundary?: string): {
    body: Buffer;
    contentType: string;
};
