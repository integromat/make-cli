import { Command } from 'commander';
import { resolveAuth } from './auth.js';
import { formatOutput, type OutputFormat } from './output.js';
import { getOrCreateSdkAppsCommand, validateMakeZone } from './icon-commands.js';

type Visibility = 'public' | 'private';

type GlobalOptions = {
    apiKey?: string;
    zone?: string;
    output?: OutputFormat;
};

export function visibilityToPublicFlag(visibility: Visibility): boolean {
    return visibility === 'public';
}

function validatePositiveInteger(value: string, name: string): void {
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }
}

export function appVisibilityEndpoint(zone: string, name: string, version: string, visibility: Visibility): string {
    validateMakeZone(zone);
    validatePositiveInteger(version, 'version');
    return `https://${zone}/api/v2/sdk/apps/${encodeURIComponent(name)}/${encodeURIComponent(version)}/${visibility}`;
}

export function moduleVisibilityEndpoint(zone: string, appName: string, appVersion: string, moduleName: string, visibility: Visibility): string {
    validateMakeZone(zone);
    validatePositiveInteger(appVersion, 'app version');
    return `https://${zone}/api/v2/sdk/apps/${encodeURIComponent(appName)}/${encodeURIComponent(appVersion)}/modules/${encodeURIComponent(moduleName)}/${visibility}`;
}

function getOrCreateSdkModulesCommand(program: Command): Command {
    const existing = program.commands.find(cmd => cmd.name() === 'sdk-modules');
    if (existing) return existing;
    return program.command('sdk-modules').description('App modules');
}

function getGlobalOptions(program: Command): GlobalOptions {
    return program.opts() as GlobalOptions;
}

async function parseErrorResponse(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    if (!text) return `${response.status} ${response.statusText}`;

    try {
        const json = JSON.parse(text) as { message?: string; detail?: string; code?: string };
        const code = json.code ? ` (${json.code})` : '';
        return `${json.message || json.detail || text}${code}`;
    } catch {
        return text;
    }
}

async function postVisibility(endpoint: string, token: string): Promise<{ changed?: boolean }> {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'text/plain',
        },
        body: '',
    });

    if (!response.ok) {
        throw new Error(`Visibility update failed: ${await parseErrorResponse(response)}`);
    }

    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
        return JSON.parse(text) as { changed?: boolean };
    } catch {
        return {};
    }
}

async function resolveVisibilityContext(program: Command): Promise<{ token: string; zone: string; output: OutputFormat }> {
    const globalOptions = getGlobalOptions(program);
    const { token, zone } = await resolveAuth({ apiKey: globalOptions.apiKey, zone: globalOptions.zone });
    validateMakeZone(zone);
    return {
        token,
        zone,
        output: (globalOptions.output as OutputFormat) ?? 'json',
    };
}

function registerAppVisibilityCommand(program: Command, sdkApps: Command, visibility: Visibility): void {
    const commandName = `set-${visibility}`;
    if (sdkApps.commands.some(cmd => cmd.name() === commandName)) return;

    sdkApps
        .command(`${commandName} <name> <version>`)
        .description(`Mark a SDK app version as ${visibility}.`)
        .action(async (name: string, version: string) => {
            const { token, zone, output } = await resolveVisibilityContext(program);
            const response = await postVisibility(appVisibilityEndpoint(zone, name, version, visibility), token);
            const result = {
                changed: response.changed ?? true,
                scope: 'app',
                appName: name,
                version: Number(version),
                visibility,
                public: visibilityToPublicFlag(visibility),
            };
            process.stdout.write(formatOutput(result, output) + '\n');
        });
}

function registerModuleVisibilityCommand(program: Command, sdkModules: Command, visibility: Visibility): void {
    const commandName = `set-${visibility}`;
    if (sdkModules.commands.some(cmd => cmd.name() === commandName)) return;

    sdkModules
        .command(`${commandName} <app-name> <app-version> <module-name>`)
        .description(`Mark a SDK app module as ${visibility}.`)
        .action(async (appName: string, appVersion: string, moduleName: string) => {
            const { token, zone, output } = await resolveVisibilityContext(program);
            const response = await postVisibility(moduleVisibilityEndpoint(zone, appName, appVersion, moduleName, visibility), token);
            const result = {
                changed: response.changed ?? true,
                scope: 'module',
                appName,
                version: Number(appVersion),
                moduleName,
                visibility,
                public: visibilityToPublicFlag(visibility),
            };
            process.stdout.write(formatOutput(result, output) + '\n');
        });
}

export function registerVisibilityCommands(program: Command): void {
    const sdkApps = getOrCreateSdkAppsCommand(program);
    const sdkModules = getOrCreateSdkModulesCommand(program);

    registerAppVisibilityCommand(program, sdkApps, 'public');
    registerAppVisibilityCommand(program, sdkApps, 'private');
    registerModuleVisibilityCommand(program, sdkModules, 'public');
    registerModuleVisibilityCommand(program, sdkModules, 'private');
}
