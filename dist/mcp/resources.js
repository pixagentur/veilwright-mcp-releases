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
    server.registerResource('privacy-policy', 'docs://veilwright/privacy-policy', {
        title: 'Datenschutzerklärung / privacy-policy workflow',
        description: 'Full workflow for generating a Datenschutzerklärung from a site\'s real technical footprint (never a template) — inventory methodology, module trigger matrix, section skeleton, supervisory-authority mapping, page-build/replace guidance.',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readFileSync(join(skillsDir, 'PRIVACY_POLICY.md'), 'utf8') }],
    }));
    server.registerResource('workflow-guide', 'docs://veilwright/workflow-guide', {
        title: 'Full Veilwright workflow guide',
        description: 'The complete site-building/editing workflow this server is built around — every section SERVER_INSTRUCTIONS only summarizes. Read this whenever a task touches something SERVER_INSTRUCTIONS references but doesn\'t fully explain (a specific section number it points to, an edge case, a "see SKILL.md" mention).',
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readFileSync(join(skillsDir, 'SKILL.md'), 'utf8') }],
    }));
}
//# sourceMappingURL=resources.js.map