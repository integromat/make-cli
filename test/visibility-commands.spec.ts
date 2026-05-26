import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Command, Option } from 'commander';
import {
    appVisibilityEndpoint,
    moduleVisibilityEndpoint,
    registerVisibilityCommands,
    visibilityToPublicFlag,
} from '../src/visibility-commands.js';

function testProgram(): Command {
    const program = new Command();
    program
        .exitOverride()
        .option('--api-key <key>')
        .option('--zone <zone>')
        .addOption(new Option('--output <format>').choices(['json', 'compact', 'table']).default('json'));
    program.command('sdk-apps').description('App definitions');
    program.command('sdk-modules').description('App modules');
    return program;
}

describe('CLI: visibility commands', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.MAKE_API_KEY;
        delete process.env.MAKE_ZONE;
    });

    it('builds SDK app visibility endpoints', () => {
        expect(appVisibilityEndpoint('eu1.make.com', 'my-app', '1', 'public')).toBe('https://eu1.make.com/api/v2/sdk/apps/my-app/1/public');
        expect(appVisibilityEndpoint('eu1.make.com', 'my app', '2', 'private')).toBe('https://eu1.make.com/api/v2/sdk/apps/my%20app/2/private');
    });

    it('builds SDK module visibility endpoints', () => {
        expect(moduleVisibilityEndpoint('eu1.make.com', 'my-app', '1', 'listItems', 'public')).toBe(
            'https://eu1.make.com/api/v2/sdk/apps/my-app/1/modules/listItems/public',
        );
        expect(moduleVisibilityEndpoint('eu1.make.com', 'my app', '2', 'Make an API Call', 'private')).toBe(
            'https://eu1.make.com/api/v2/sdk/apps/my%20app/2/modules/Make%20an%20API%20Call/private',
        );
    });

    it('maps visibility names to public booleans', () => {
        expect(visibilityToPublicFlag('public')).toBe(true);
        expect(visibilityToPublicFlag('private')).toBe(false);
    });

    it('registers app and module visibility commands', () => {
        const program = testProgram();
        registerVisibilityCommands(program);

        const sdkApps = program.commands.find(c => c.name() === 'sdk-apps');
        const sdkModules = program.commands.find(c => c.name() === 'sdk-modules');

        expect(sdkApps?.commands.find(c => c.name() === 'set-public')).toBeDefined();
        expect(sdkApps?.commands.find(c => c.name() === 'set-private')).toBeDefined();
        expect(sdkModules?.commands.find(c => c.name() === 'set-public')).toBeDefined();
        expect(sdkModules?.commands.find(c => c.name() === 'set-private')).toBeDefined();
    });

    it('posts to the module public endpoint and prints structured output', async () => {
        process.env.MAKE_API_KEY = 'test-token';
        process.env.MAKE_ZONE = 'eu1.make.com';

        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ changed: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
        const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

        const program = testProgram();
        registerVisibilityCommands(program);
        await program.parseAsync(['node', 'make-cli', 'sdk-modules', 'set-public', 'my-app', '1', 'listItems'], { from: 'node' });

        expect(fetchMock).toHaveBeenCalledWith('https://eu1.make.com/api/v2/sdk/apps/my-app/1/modules/listItems/public', {
            method: 'POST',
            headers: {
                Authorization: 'Token test-token',
                'Content-Type': 'text/plain',
            },
            body: '',
        });
        const output = stdout.mock.calls.map(call => String(call[0])).join('');
        expect(JSON.parse(output)).toMatchObject({ scope: 'module', appName: 'my-app', moduleName: 'listItems', public: true });
    });
});
