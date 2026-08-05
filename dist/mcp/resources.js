import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Served live from this running process — not a separate skill zip
 * the user has to upload and later remember to re-upload. Whatever
 * version of veilwright-mcp is installed is what gets read here, so
 * it stays current automatically across releases.
 *
 * Path resolution: this file compiles to dist/mcp/resources.js, and
 * the release folder ships skills/ as a sibling of dist/ (see
 * .github/workflows/publish-releases-repo.yml), so the reference
 * docs live two directories up from here.
 */
const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'veilwright-workflow');
export function registerResources(server) {
    server.registerResource('elementor-widgets', 'docs://veilwright/elementor-widgets', {
        title: 'Elementor widget reference',
        description: 'widgetType/settings shapes for page_addElementorWidget and elementorTemplate_create, with a confidence tier per widget (learned from real Elementor exports, not guessed).',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readFileSync(join(skillsDir, 'ELEMENTOR_WIDGETS.md'), 'utf8') }],
    }));
    server.registerResource('fluent-forms', 'docs://veilwright/fluent-forms', {
        title: 'Fluent Forms field reference',
        description: 'Known-good field/settings shape for form_createFluentForm, learned from real Fluent Forms exports.',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readFileSync(join(skillsDir, 'FLUENT_FORMS.md'), 'utf8') }],
    }));
}
//# sourceMappingURL=resources.js.map