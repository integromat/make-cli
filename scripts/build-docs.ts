import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MakeTools } from '@makehq/sdk/tools';
import type { MakeTool, JSONSchema } from '@makehq/sdk/tools';
import { CATEGORY_TITLES, CATEGORY_GROUPS } from '../src/categories.js';
import { camelToKebab, formatExampleCommand } from '../src/examples.js';
import { deriveActionName, deriveSelfIdentifier } from '../src/commands.js';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');

function schemaTypeLabel(schema: JSONSchema): string {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (type === 'array' && schema.items) {
        const inner = Array.isArray(schema.items.type) ? schema.items.type[0] : schema.items.type;
        return `${inner}[]`;
    }
    return type ?? 'string';
}

function buildToolSection(tool: MakeTool, categorySlug: string): string {
    const action = deriveActionName(tool.name, tool.category);
    const lines: string[] = [];

    lines.push(`### \`make-cli ${categorySlug} ${action}\``);
    lines.push('');
    lines.push(tool.description);
    lines.push('');

    const properties = tool.inputSchema.properties ?? {};
    const required = new Set(tool.inputSchema.required ?? []);
    const propEntries = Object.entries(properties);
    const selfIdProperty = deriveSelfIdentifier(tool);
    const selfIdSchema = selfIdProperty ? properties[selfIdProperty] : undefined;
    const selfIdFlag = selfIdProperty ? `--${camelToKebab(selfIdProperty)}` : undefined;

    if (selfIdProperty && selfIdSchema && selfIdFlag) {
        const argName = camelToKebab(selfIdProperty);
        const isRequired = required.has(selfIdProperty);
        // Keep positional argument notation aligned with the CLI `--help` Usage
        // lines, which render this self identifier as `[arg]` regardless of
        // logical requiredness — the positional is always registered as
        // optional at the Commander level so the `--<arg>` flag alternative
        // stays valid. Requiredness is conveyed separately via the Required
        // column and the description.
        const argToken = `[${argName}]`;
        const rawDesc = selfIdSchema.description?.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() ?? '';
        // SDK descriptions generally omit trailing punctuation; normalize to a
        // single '.' so the cross-reference clause reads as a second sentence.
        const baseDesc = rawDesc ? rawDesc.replace(/[.!?]+$/, '') + '.' : '';
        const desc = baseDesc
            ? `${baseDesc} Can also be passed as \`${selfIdFlag}=<value>\`.`
            : `Can also be passed as \`${selfIdFlag}=<value>\`.`;

        lines.push('**Arguments**');
        lines.push('');
        lines.push('| Argument | Description | Required |');
        lines.push('|----------|-------------|----------|');
        lines.push(`| \`${argToken}\` | ${desc} | ${isRequired ? 'Yes' : 'No'} |`);
        lines.push('');
    }

    const flagEntries = propEntries.filter(([propName]) => propName !== selfIdProperty);

    if (flagEntries.length > 0) {
        lines.push('**Options**');
        lines.push('');
        lines.push('| Option | Description | Required |');
        lines.push('|--------|-------------|----------|');

        for (const [propName, schema] of flagEntries) {
            const flagName = camelToKebab(propName);
            const type = schemaTypeLabel(schema);
            const isBooleanFlag = type === 'boolean';
            const longForm = isBooleanFlag && schema.default === true ? `--no-${flagName}` : `--${flagName}`;

            const isRequired = required.has(propName) && !isBooleanFlag;
            const propDesc = schema.description?.replace(/\|/g, '\\|').replace(/\n/g, ' ') ?? '';

            lines.push(`| \`${longForm}\` | ${propDesc} | ${isRequired ? 'Yes' : 'No'} |`);
        }

        lines.push('');
    }

    lines.push('**Example**');
    lines.push('');
    lines.push('```bash');

    const cmd = `make-cli ${categorySlug} ${action}`;
    const example = tool.examples?.[0];
    if (example && Object.keys(example).length > 0) {
        lines.push(formatExampleCommand(cmd, example, selfIdProperty));
    } else {
        lines.push(cmd);
    }

    lines.push('```');

    return lines.join('\n');
}

function buildCategoryDoc(categorySlug: string, tools: MakeTool[]): string {
    const originalCategory = tools[0]!.category;
    const title = CATEGORY_TITLES[originalCategory] ?? categorySlug;
    const lines: string[] = [];

    lines.push(`## ${title}`);
    lines.push('');
    lines.push(`Manage your ${title.toLowerCase()}.`);
    lines.push('');
    lines.push('---');

    for (let i = 0; i < tools.length; i++) {
        lines.push('');
        lines.push(buildToolSection(tools[i]!, categorySlug));
        if (i < tools.length - 1) {
            lines.push('');
            lines.push('---');
        }
    }

    lines.push('');

    return lines.join('\n');
}

function buildIndex(categoryMap: Map<string, MakeTool[]>): string {
    const lines: string[] = [];

    lines.push('# Make CLI Documentation');
    lines.push('');
    lines.push('Command-line tool for the [Make](https://www.make.com) automation platform.');
    lines.push('');
    lines.push('## Global Options');
    lines.push('');
    lines.push('| Flag | Description |');
    lines.push('| --- | --- |');
    lines.push('| `--api-key <key>` | Make API key (or set `MAKE_API_KEY` env var) |');
    lines.push('| `--zone <zone>` | Make zone, e.g. `eu1.make.com` (or set `MAKE_ZONE` env var) |');
    lines.push('| `--output <format>` | Output format: `json` (default), `compact`, `table` |');
    lines.push('| `--version` | Show version number |');
    lines.push('| `--help` | Display help |');
    lines.push('');
    lines.push('## Authentication');
    lines.push('');
    lines.push('```bash');
    lines.push('# Interactive login (saves credentials locally)');
    lines.push('make-cli login');
    lines.push('');
    lines.push('# Check who you are logged in as');
    lines.push('make-cli whoami');
    lines.push('');
    lines.push('# Log out');
    lines.push('make-cli logout');
    lines.push('```');
    lines.push('');
    lines.push('## Command Reference');
    lines.push('');

    const groups = new Map<string, { slug: string; title: string }[]>();

    for (const [slug, tools] of categoryMap) {
        const originalCategory = tools[0]!.category;
        const title = CATEGORY_TITLES[originalCategory] ?? slug;
        const group = CATEGORY_GROUPS[originalCategory] ?? 'Commands:';
        const groupName = group.replace(/:$/, '');

        const entries = groups.get(groupName) ?? [];
        entries.push({ slug, title });
        groups.set(groupName, entries);
    }

    for (const [groupName, entries] of groups) {
        lines.push(`### ${groupName}`);
        lines.push('');
        lines.push('| Category | Description |');
        lines.push('| --- | --- |');
        for (const { slug, title } of entries) {
            lines.push(`| [\`${slug}\`](./${slug}.md) | ${title} |`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

// --- Main ---

const categoryMap = new Map<string, MakeTool[]>();

for (const tool of MakeTools) {
    const slug = tool.category.replace(/\./g, '-');
    const group = categoryMap.get(slug) ?? [];
    group.push(tool);
    categoryMap.set(slug, group);
}

if (!existsSync(DOCS_DIR)) {
    mkdirSync(DOCS_DIR, { recursive: true });
}

for (const [slug, tools] of categoryMap) {
    const content = buildCategoryDoc(slug, tools);
    writeFileSync(join(DOCS_DIR, `${slug}.md`), content);
}

const index = buildIndex(categoryMap);
writeFileSync(join(DOCS_DIR, 'README.md'), index);

const totalTools = MakeTools.length;
const totalCategories = categoryMap.size;
console.log(`Generated docs for ${totalTools} commands across ${totalCategories} categories in docs/`);
