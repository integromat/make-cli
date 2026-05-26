import { describe, expect, it } from '@jest/globals';
import { Command, Option } from 'commander';
import { registerIconCommands, readPngInfo, validateMakeZone } from '../src/icon-commands.js';

function minimalPng(width = 512, height = 512): Buffer {
    const buffer = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

describe('CLI: icon commands', () => {
    it('parses PNG dimensions from the IHDR chunk', () => {
        expect(readPngInfo(minimalPng(512, 512))).toEqual({ width: 512, height: 512 });
        expect(readPngInfo(minimalPng(64, 128))).toEqual({ width: 64, height: 128 });
    });

    it('rejects non-PNG files', () => {
        expect(() => readPngInfo(Buffer.from('not a png'))).toThrow('Icon file must be a PNG image');
    });

    it('accepts Make zone hostnames and rejects unsafe zones', () => {
        expect(() => validateMakeZone('eu1.make.com')).not.toThrow();
        expect(() => validateMakeZone('us1.make.com')).not.toThrow();
        expect(() => validateMakeZone('evil.example.com')).toThrow('Invalid Make zone');
        expect(() => validateMakeZone('eu1.make.com.evil.test')).toThrow('Invalid Make zone');
        expect(() => validateMakeZone('https://eu1.make.com')).toThrow('Invalid Make zone');
    });

    it('exposes integer validation through get-icon readback command arguments', () => {
        const program = new Command();
        program
            .option('--api-key <key>')
            .option('--zone <zone>')
            .addOption(new Option('--output <format>').choices(['json', 'compact', 'table']).default('json'));
        program.command('sdk-apps').description('App definitions');
        registerIconCommands(program);

        const getIcon = program.commands.find(c => c.name() === 'sdk-apps')?.commands.find(c => c.name() === 'get-icon');
        expect(getIcon?.options.find(o => o.long === '--size')?.defaultValue).toBe('512');
    });

    it('registers sdk-apps set-icon and get-icon commands on an existing category command', () => {
        const program = new Command();
        program
            .option('--api-key <key>')
            .option('--zone <zone>')
            .addOption(new Option('--output <format>').choices(['json', 'compact', 'table']).default('json'));
        program.command('sdk-apps').description('App definitions');

        registerIconCommands(program);

        const sdkApps = program.commands.find(c => c.name() === 'sdk-apps');
        expect(sdkApps).toBeDefined();
        expect(sdkApps?.commands.find(c => c.name() === 'set-icon')).toBeDefined();
        expect(sdkApps?.commands.find(c => c.name() === 'get-icon')).toBeDefined();
    });
});
