// Builds the public copy of the API spec for the /developer page: oas/OAS.yaml minus the platform-management
// (super-admin) and internal (auth-server callback) endpoints, with everything only they used pruned too.
// Runs before `next build` / `next dev`; the result is generated, not committed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../oas/OAS.yaml');
const target = resolve(root, 'public/openapi/OAS.json');

// The source spec points at localhost for local development; the public page documents production.
const PRODUCTION_SERVER = { url: 'https://api.salonsaas.org', description: 'Production' };
const HIDDEN_PREFIXES = ['/api/salon-super-admin', '/internal'];
const spec = parse(readFileSync(source, 'utf8'));
spec.servers = [PRODUCTION_SERVER];

spec.paths = Object.fromEntries(
  Object.entries(spec.paths).filter(([path]) => !HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))),
);

// The intro is Markdown; drop any line that documents a hidden area.
spec.info.description = spec.info.description
  .split('\n')
  .filter((line) => !/super[- ]admin/i.test(line) && !HIDDEN_PREFIXES.some((prefix) => line.includes(prefix)))
  .join('\n');

// Descriptions elsewhere point at hidden endpoints ("…use PUT /api/salon-super-admin/… to change the owner").
// Cut those clauses so the page never links to something it doesn't show.
const hiddenPath = HIDDEN_PREFIXES.map((prefix) => prefix.replaceAll('/', '\\/')).join('|');
const dangling = new RegExp(`\\s*(?:—\\s*)?(?:[Tt]o [^.\\n]*?, )?use [A-Z]+ (?:${hiddenPath})\\S*(?: to [^.\\n]*)?(?: \\([^)]*\\))?\\.`, 'g');
const scrub = (node) => {
  if (typeof node === 'string') return node.replace(dangling, '.').replace(/\.\.+/g, '.');
  if (Array.isArray(node)) return node.map(scrub);
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, scrub(value)]));
  return node;
};
spec.paths = scrub(spec.paths);

// Keep only the components that the remaining paths can reach, following $refs transitively.
const components = spec.components ?? {};
const kept = new Set();
const queue = [];
const collect = (node) => {
  if (Array.isArray(node)) return node.forEach(collect);
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith('#/components/')) {
        if (!kept.has(value)) { kept.add(value); queue.push(value); }
      } else collect(value);
    }
  }
};
collect(spec.paths);
while (queue.length) {
  const [, , section, name] = queue.shift().split('/');
  collect(components[section]?.[name]);
}
for (const section of Object.keys(components)) {
  if (section === 'securitySchemes') continue;
  components[section] = scrub(components[section]);
  components[section] = Object.fromEntries(Object.entries(components[section]).filter(([name]) => kept.has(`#/components/${section}/${name}`)));
}

// Tags nobody uses any more (the super-admin ones) would only add empty headings.
const used = new Set(Object.values(spec.paths).flatMap((item) => Object.values(item).flatMap((op) => op?.tags ?? [])));
spec.tags = (spec.tags ?? []).filter((tag) => used.has(tag.name));

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(spec));
console.log(`openapi: ${Object.keys(spec.paths).length} paths published to ${target}`);
