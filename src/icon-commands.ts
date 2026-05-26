import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { resolveAuth } from './auth.js';
import { formatOutput, type OutputFormat } from './output.js';

type PngInfo = {
    width: number;
    height: number;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_SDK_VERSION = '2.5.0';

export function getOrCreateSdkAppsCommand(program: Command): Command {
    const existing = program.commands.find(cmd => cmd.name() === 'sdk-apps');
    if (existing) return existing;
    return program.command('sdk-apps').description('App definitions');
}

export function readPngInfo(buffer: Buffer): PngInfo {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error('Icon file must be a PNG image.');
    }

    const ihdrType = buffer.subarray(12, 16).toString('ascii');
    if (ihdrType !== 'IHDR') {
        throw new Error('Icon file is not a valid PNG image: missing IHDR chunk.');
    }

    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}

export function validateMakeZone(zone: string): void {
    if (!/^[A-Za-z0-9.-]+$/.test(zone) || zone.startsWith('.') || zone.includes('..') || !zone.endsWith('.make.com')) {
        throw new Error(`Invalid Make zone: ${zone}. Expected a make.com zone hostname, e.g. eu1.make.com.`);
    }
}

function getGlobalOptions(cmd: Command): { apiKey?: string; zone?: string; output?: OutputFormat } {
    return cmd.optsWithGlobals() as { apiKey?: string; zone?: string; output?: OutputFormat };
}

function iconEndpoint(zone: string, name: string, version: string): string {
    validatePositiveInteger(version, 'version');
    return `https://${zone}/api/v2/sdk/apps/${encodeURIComponent(name)}/${encodeURIComponent(version)}/icon`;
}

function iconReadbackEndpoint(zone: string, name: string, version: string, size: string): string {
    validatePositiveInteger(size, 'size');
    return `${iconEndpoint(zone, name, version)}/${encodeURIComponent(size)}`;
}

function validatePositiveInteger(value: string, name: string): void {
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }
}

async function parseErrorResponse(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    if (!text) return `${response.status} ${response.statusText}`;

    try {
        const json = JSON.parse(text) as { message?: string; detail?: string };
        return json.message || json.detail || text;
    } catch {
        return text;
    }
}

export function registerIconCommands(program: Command): void {
    const sdkApps = getOrCreateSdkAppsCommand(program);

    if (!sdkApps.commands.some(cmd => cmd.name() === 'set-icon')) {
        sdkApps
            .command('set-icon <name> <version> <file>')
            .description('Upload a 512x512 PNG icon for a SDK app.')
            .option('--allow-non-512', 'upload a PNG even if it is not 512x512')
            .option('--sdk-version <version>', 'Apps SDK version header', DEFAULT_SDK_VERSION)
            .action(async (name: string, version: string, file: string, options: { allowNon512?: boolean; sdkVersion: string }, cmd: Command) => {
                const globalOptions = getGlobalOptions(cmd);
                const { token, zone } = await resolveAuth({ apiKey: globalOptions.apiKey, zone: globalOptions.zone });
                validateMakeZone(zone);

                const icon = await readFile(file);
                const pngInfo = readPngInfo(icon);
                if (!options.allowNon512 && (pngInfo.width !== 512 || pngInfo.height !== 512)) {
                    throw new Error(
                        `Icon must be 512x512 PNG. Got ${pngInfo.width}x${pngInfo.height}. ` +
                            'Resize it first or pass --allow-non-512 intentionally.',
                    );
                }

                const response = await fetch(iconEndpoint(zone, name, version), {
                    method: 'PUT',
                    headers: {
                        Authorization: `Token ${token}`,
                        'Content-Type': 'image/png',
                        'imt-apps-sdk-version': options.sdkVersion || DEFAULT_SDK_VERSION,
                    },
                    body: icon,
                });

                if (!response.ok) {
                    throw new Error(`Icon upload failed: ${await parseErrorResponse(response)}`);
                }

                const result = {
                    changed: true,
                    appName: name,
                    version: Number(version),
                    file: basename(file),
                    width: pngInfo.width,
                    height: pngInfo.height,
                    readbackUrl: iconReadbackEndpoint(zone, name, version, '512'),
                };
                process.stdout.write(formatOutput(result, (globalOptions.output as OutputFormat) ?? 'json') + '\n');
            });
    }

    if (!sdkApps.commands.some(cmd => cmd.name() === 'get-icon')) {
        sdkApps
            .command('get-icon <name> <version> [output-file]')
            .description('Download a SDK app icon.')
            .option('--size <size>', 'icon size to download', '512')
            .option('--sdk-version <version>', 'Apps SDK version header', DEFAULT_SDK_VERSION)
            .action(async (name: string, version: string, outputFile: string | undefined, options: { size: string; sdkVersion: string }, cmd: Command) => {
                const globalOptions = getGlobalOptions(cmd);
                const { token, zone } = await resolveAuth({ apiKey: globalOptions.apiKey, zone: globalOptions.zone });
                validateMakeZone(zone);

                const response = await fetch(iconReadbackEndpoint(zone, name, version, options.size), {
                    headers: {
                        Authorization: `Token ${token}`,
                        'imt-apps-sdk-version': options.sdkVersion || DEFAULT_SDK_VERSION,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Icon download failed: ${await parseErrorResponse(response)}`);
                }

                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                if (!contentType.includes('image/png')) {
                    throw new Error(`Icon download returned unexpected content type: ${contentType || 'unknown'}`);
                }

                const icon = Buffer.from(await response.arrayBuffer());
                const pngInfo = readPngInfo(icon);
                if (outputFile) {
                    await writeFile(outputFile, icon);
                    const result = {
                        appName: name,
                        version: Number(version),
                        file: outputFile,
                        width: pngInfo.width,
                        height: pngInfo.height,
                    };
                    process.stdout.write(formatOutput(result, (globalOptions.output as OutputFormat) ?? 'json') + '\n');
                } else {
                    process.stdout.write(icon);
                }
            });
    }
}
