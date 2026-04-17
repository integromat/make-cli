import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export type Config = { apiKey: string; zone: string };

export function getConfigPath(): string {
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA ?? os.homedir();
        return path.join(appData, 'make-cli', 'config.json');
    }
    const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    return path.join(xdgConfigHome, 'make-cli', 'config.json');
}

export async function readConfig(): Promise<Config | null> {
    try {
        const raw = await readFile(getConfigPath(), 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'apiKey' in parsed &&
            'zone' in parsed &&
            typeof (parsed as Record<string, unknown>).apiKey === 'string' &&
            typeof (parsed as Record<string, unknown>).zone === 'string'
        ) {
            return parsed as Config;
        }
        return null;
    } catch {
        return null;
    }
}

export async function writeConfig(config: Config): Promise<void> {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    const tmp = configPath + '.tmp';
    await mkdir(dir, { recursive: true });
    await writeFile(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
    await rename(tmp, configPath);
}

export async function deleteConfig(): Promise<void> {
    try {
        await rm(getConfigPath());
    } catch {
        // silently succeed if file doesn't exist
    }
}
