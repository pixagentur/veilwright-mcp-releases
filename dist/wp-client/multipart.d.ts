export interface MultipartFile {
    fieldName: string;
    filename: string;
    contentType: string;
    data: Buffer;
}
/**
 * Builds a multipart/form-data body manually rather than delegating
 * to fetch's automatic FormData serialization. The HMAC signature
 * must be computed over the exact bytes that get sent — with
 * FormData, those bytes aren't available until fetch serializes the
 * request internally, which is too late to sign. A fixed boundary
 * can be injected for deterministic tests.
 */
export declare function buildMultipartBody(fields: Record<string, string>, file: MultipartFile, boundary?: string): {
    body: Buffer;
    contentType: string;
};
