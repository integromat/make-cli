import type { JSONValue } from '@makehq/sdk';

/**
 * Converts a camelCase string to kebab-case.
 */
export function camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Formats a single example value for shell display.
 * Returns both a flat (single-line) and an expanded (possibly multi-line) representation.
 * JSON strings longer than 60 characters are pretty-printed in the expanded form.
 */
export function formatExampleValue(value: JSONValue): { flat: string; expanded: string } {
    if (typeof value === 'number') {
        const s = String(value);
        return { flat: s, expanded: s };
    }

    if (typeof value === 'string') {
        let parsed: unknown;
        try {
            parsed = JSON.parse(value);
        } catch {
            /* not JSON */
        }

        if (typeof parsed === 'object' && parsed !== null) {
            const compact = JSON.stringify(parsed);
            const flat = `'${compact}'`;
            if (compact.length <= 60) {
                return { flat, expanded: flat };
            }
            const pretty = JSON.stringify(parsed, null, 2);
            const prettyLines = pretty.split('\n');
            const indented = prettyLines.map((l, i) => (i === 0 ? l : '  ' + l));
            return { flat, expanded: `'${indented.join('\n')}'` };
        }

        if (/[\s'"]/.test(value)) {
            const q = `'${value}'`;
            return { flat: q, expanded: q };
        }
        return { flat: value, expanded: value };
    }

    if (typeof value === 'object' && value !== null) {
        const compact = JSON.stringify(value);
        const flat = `'${compact}'`;
        if (compact.length <= 60) {
            return { flat, expanded: flat };
        }
        const pretty = JSON.stringify(value, null, 2);
        const prettyLines = pretty.split('\n');
        const indented = prettyLines.map((l, i) => (i === 0 ? l : '  ' + l));
        return { flat, expanded: `'${indented.join('\n')}'` };
    }

    const s = String(value);
    return { flat: s, expanded: s };
}

/**
 * Builds a formatted shell example command from a base command and an example payload.
 * Uses single-line format when the result fits within 80 characters,
 * otherwise switches to multi-line with backslash continuations.
 */
export function formatExampleCommand(command: string, example: Record<string, JSONValue>): string {
    const entries = Object.entries(example).filter(([, v]) => v !== false);
    if (entries.length === 0) return command;

    const args: { flat: string; expanded: string }[] = [];
    for (const [name, value] of entries) {
        const flag = `--${camelToKebab(name)}`;
        if (typeof value === 'boolean') {
            args.push({ flat: flag, expanded: flag });
        } else {
            const formatted = formatExampleValue(value);
            args.push({
                flat: `${flag}=${formatted.flat}`,
                expanded: `${flag}=${formatted.expanded}`,
            });
        }
    }

    const singleLine = `${command} ${args.map(a => a.flat).join(' ')}`;
    const hasMultiLine = args.some(a => a.expanded.includes('\n'));

    if (!hasMultiLine && singleLine.length <= 80) {
        return singleLine;
    }

    const blocks = [command, ...args.map(a => `  ${a.expanded}`)];
    const parts: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
        if (i < blocks.length - 1) {
            const blockLines = blocks[i]!.split('\n');
            blockLines[blockLines.length - 1] += ' \\';
            parts.push(blockLines.join('\n'));
        } else {
            parts.push(blocks[i]!);
        }
    }
    return parts.join('\n');
}
