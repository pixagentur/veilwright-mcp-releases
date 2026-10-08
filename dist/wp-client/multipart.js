import { createHash, randomBytes } from 'node:crypto';
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
export function canonicalMultipartBody(fields, file) {
    const fileHash = createHash('sha256').update(file.data).digest('hex');
    const lines = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${fields[key]}`);
    lines.push(`file=${fileHash}`);
    return lines.join('\n');
}
/**
 * Builds a multipart/form-data body manually rather than delegating
 * to fetch's automatic FormData serialization — its bytes aren't
 * available until fetch serializes the request internally, which is
 * too late to construct the actual request payload predictably (the
 * signature itself is computed over `canonicalMultipartBody()`
 * above, not these bytes — see its docblock for why). A fixed
 * boundary can be injected for deterministic tests.
 */
export function buildMultipartBody(fields, file, boundary = `----veilwright-${randomBytes(16).toString('hex')}`) {
    const parts = [];
    for (const [name, value] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'));
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`, 'utf8'), file.data, Buffer.from('\r\n', 'utf8'));
    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
    return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
//# sourceMappingURL=multipart.js.map