const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
};
export function detectMimeType(filename) {
    const dot = filename.lastIndexOf('.');
    if (dot === -1) {
        return 'application/octet-stream';
    }
    const ext = filename.slice(dot).toLowerCase();
    return MIME_TYPES[ext] ?? 'application/octet-stream';
}
//# sourceMappingURL=mimeTypes.js.map