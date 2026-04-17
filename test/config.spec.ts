import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import * as os from 'node:os';
import * as path from 'node:path';
import { rm } from 'node:fs/promises';
import { getConfigPath, readConfig, writeConfig, deleteConfig } from '../src/config.js';

describe('getConfigPath', () => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        process.env = { ...originalEnv };
    });

    it('should use XDG_CONFIG_HOME when set on non-Windows', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.XDG_CONFIG_HOME = '/custom/config';
        delete process.env.APPDATA;
        expect(getConfigPath()).toBe('/custom/config/make-cli/config.json');
    });

    it('should fall back to ~/.config on non-Windows when XDG_CONFIG_HOME not set', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        delete process.env.XDG_CONFIG_HOME;
        delete process.env.APPDATA;
        const expected = path.join(os.homedir(), '.config', 'make-cli', 'config.json');
        expect(getConfigPath()).toBe(expected);
    });

    it('should use APPDATA on Windows', () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';
        const expected = path.join('C:\\Users\\test\\AppData\\Roaming', 'make-cli', 'config.json');
        expect(getConfigPath()).toBe(expected);
    });

    it('should fall back to homedir on Windows when APPDATA not set', () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        delete process.env.APPDATA;
        const expected = path.join(os.homedir(), 'make-cli', 'config.json');
        expect(getConfigPath()).toBe(expected);
    });
});

describe('readConfig / writeConfig / deleteConfig', () => {
    const tmpDir = path.join(os.tmpdir(), `make-cli-test-${process.pid}`);
    const originalEnv = { ...process.env };
    const originalPlatform = process.platform;

    beforeEach(() => {
        // Point config to a temp directory
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.XDG_CONFIG_HOME = tmpDir;
    });

    afterEach(async () => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        process.env = { ...originalEnv };
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should return null when config file does not exist', async () => {
        const result = await readConfig();
        expect(result).toBeNull();
    });

    it('should write and read back a config', async () => {
        await writeConfig({ apiKey: 'test-key', zone: 'eu1.make.com' });
        const result = await readConfig();
        expect(result).toEqual({ apiKey: 'test-key', zone: 'eu1.make.com' });
    });

    it('should return null for malformed JSON', async () => {
        const { writeFile, mkdir } = await import('node:fs/promises');
        const configPath = getConfigPath();
        await mkdir(path.dirname(configPath), { recursive: true });
        await writeFile(configPath, 'not valid json', 'utf8');
        const result = await readConfig();
        expect(result).toBeNull();
    });

    it('should delete the config file silently', async () => {
        await writeConfig({ apiKey: 'test-key', zone: 'eu1.make.com' });
        await deleteConfig();
        expect(await readConfig()).toBeNull();
    });

    it('should not throw when deleting a non-existent config', async () => {
        await expect(deleteConfig()).resolves.toBeUndefined();
    });
});
