import { describe, expect, it } from '@jest/globals';
import { formatExampleValue, formatExampleCommand, camelToKebab } from '../src/examples.js';

describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
        expect(camelToKebab('teamId')).toBe('team-id');
        expect(camelToKebab('scenarioId')).toBe('scenario-id');
        expect(camelToKebab('dataStoreId')).toBe('data-store-id');
    });

    it('should leave single words unchanged', () => {
        expect(camelToKebab('name')).toBe('name');
        expect(camelToKebab('status')).toBe('status');
    });
});

describe('formatExampleValue', () => {
    it('should format numbers', () => {
        expect(formatExampleValue(5)).toEqual({ flat: '5', expanded: '5' });
        expect(formatExampleValue(3.14)).toEqual({ flat: '3.14', expanded: '3.14' });
    });

    it('should format plain strings', () => {
        expect(formatExampleValue('my-app')).toEqual({ flat: 'my-app', expanded: 'my-app' });
    });

    it('should quote strings with spaces', () => {
        expect(formatExampleValue('hello world')).toEqual({
            flat: "'hello world'",
            expanded: "'hello world'",
        });
    });

    it('should quote strings with quotes', () => {
        expect(formatExampleValue('say "hi"')).toEqual({
            flat: `'say "hi"'`,
            expanded: `'say "hi"'`,
        });
    });

    it('should format short JSON strings as compact single-quoted', () => {
        const result = formatExampleValue('{"type":"on-demand"}');
        expect(result.flat).toBe(`'{"type":"on-demand"}'`);
        expect(result.expanded).toBe(result.flat);
    });

    it('should expand long JSON strings into pretty-printed multi-line', () => {
        const longJson = JSON.stringify({
            name: 'Test Scenario',
            flow: [{ id: 1, module: 'google-email:watchEmails', version: 1, parameters: { connection: 5 } }],
        });
        const result = formatExampleValue(longJson);

        expect(result.flat).toBe(`'${longJson}'`);
        expect(result.expanded).toContain('\n');
        expect(result.expanded).toMatch(/^'\{/);
        expect(result.expanded).toMatch(/\}'$/);
        expect(result.expanded).toContain('    "name": "Test Scenario"');
    });

    it('should indent multi-line JSON with 2 extra spaces per level', () => {
        const obj = {
            name: 'A long enough name to push this past the sixty character limit',
            nested: { key: 'value' },
        };
        const json = JSON.stringify(obj);
        expect(json.length).toBeGreaterThan(60);

        const result = formatExampleValue(json);
        const lines = result.expanded.split('\n');
        // First line starts with '{
        expect(lines[0]).toBe("'{");
        // Property lines get 2 extra spaces (JSON indent 2 + extra 2 = 4)
        expect(lines[1]).toMatch(/^ {4}"/);
        // Last line is closing }'
        expect(lines[lines.length - 1]).toMatch(/^ {2}\}'$/);
    });

    it('should format short direct objects as compact', () => {
        const result = formatExampleValue({ key: 'value' });
        expect(result.flat).toBe(`'{"key":"value"}'`);
        expect(result.expanded).toBe(result.flat);
    });

    it('should expand long direct objects into multi-line', () => {
        const obj = {
            input: [{ name: 'myInput', type: 'text', required: true }],
            output: [{ name: 'myOutput', type: 'text' }],
            extra: 'padding to make this object long enough to exceed the threshold',
        };
        const result = formatExampleValue(obj);
        expect(result.expanded).toContain('\n');
    });

    it('should handle null and undefined', () => {
        expect(formatExampleValue(null)).toEqual({ flat: 'null', expanded: 'null' });
        expect(formatExampleValue(undefined)).toEqual({ flat: 'undefined', expanded: 'undefined' });
    });
});

describe('formatExampleCommand', () => {
    it('should return just the command for empty examples', () => {
        expect(formatExampleCommand('make-cli apps list', {})).toBe('make-cli apps list');
    });

    it('should format a single numeric arg on one line', () => {
        const result = formatExampleCommand('make-cli scenarios list', { teamId: 5 });
        expect(result).toBe('make-cli scenarios list --team-id=5');
    });

    it('should format multiple short args on one line', () => {
        const result = formatExampleCommand('make-cli apps get', { name: 'my-app', version: 1 });
        expect(result).toBe('make-cli apps get --name=my-app --version=1');
    });

    it('should format boolean true as bare flag', () => {
        const result = formatExampleCommand('make-cli scenarios run', {
            scenarioId: 925,
            responsive: true,
        });
        expect(result).toBe('make-cli scenarios run --scenario-id=925 --responsive');
    });

    it('should skip boolean false values', () => {
        const result = formatExampleCommand('make-cli scenarios run', {
            scenarioId: 925,
            responsive: false,
        });
        expect(result).toBe('make-cli scenarios run --scenario-id=925');
    });

    it('should switch to multi-line when exceeding 80 characters', () => {
        const result = formatExampleCommand('make-cli scenarios update', {
            scenarioId: 925,
            name: 'Updated Scenario',
            scheduling: '{"type":"indefinitely","interval":900}',
        });
        expect(result).toContain(' \\\n');
        expect(result).toMatch(/^make-cli scenarios update \\/);
        expect(result).toContain('  --scenario-id=925');
    });

    it('should switch to multi-line when values contain newlines', () => {
        const longJson = JSON.stringify({
            name: 'Gmail Attachments to Google Drive',
            flow: [{ id: 1, module: 'google-email:watchEmails', version: 1, parameters: { connection: 5 } }],
        });
        const result = formatExampleCommand('make-cli scenarios create', {
            teamId: 5,
            blueprint: longJson,
        });
        expect(result).toContain(' \\\n');
        expect(result).toContain("  --blueprint='{");
    });

    it('should place backslash continuations on the last line of multi-line args', () => {
        const longJson = JSON.stringify({ key: 'x'.repeat(80) });
        const result = formatExampleCommand('make-cli test cmd', {
            first: longJson,
            second: 42,
        });
        const lines = result.split('\n');
        // The closing }' of the first arg should have ' \' appended
        const closingLine = lines.find(l => l.includes("}'"));
        expect(closingLine).toMatch(/\\$/);
        // The last line should NOT have a backslash
        expect(lines[lines.length - 1]).not.toMatch(/\\$/);
    });

    it('should not add backslash after the last argument', () => {
        const result = formatExampleCommand('make-cli scenarios update', {
            scenarioId: 925,
            name: 'Updated Scenario',
            scheduling: '{"type":"indefinitely","interval":900}',
        });
        const lines = result.split('\n');
        expect(lines[lines.length - 1]).not.toMatch(/\\$/);
    });
});
