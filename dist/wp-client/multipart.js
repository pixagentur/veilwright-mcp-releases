import { randomBytes } from 'node:crypto';
/**
 * Builds a multipart/form-data body manually rather than delegating
 * to fetch's automatic FormData serialization. The HMAC signature
 * must be computed over the exact bytes that get sent — with
 * FormData, those bytes aren't available until fetch serializes the
 * request internally, which is too late to sign. A fixed boundary
 * can be injected for deterministic tests.
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