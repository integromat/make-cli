import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import type { Config } from '../src/config.js';
import { resolveAuth } from '../src/auth.js';
import { readConfig } from '../src/config.js';

jest.mock('../src/config.js', () => ({
    readConfig: jest.fn<() => Promise<Config | null>>(),
}));

const mockReadConfig = readConfig as jest.MockedFunction<typeof readConfig>;

describe('resolveAuth: config file fallback', () => {
    beforeEach(() => {
        delete process.env.MAKE_API_KEY;
        delete process.env.MAKE_ZONE;
        mockReadConfig.mockReset();
    });

    afterEach(() => {
        delete process.env.MAKE_API_KEY;
        delete process.env.MAKE_ZONE;
    });

    it('should resolve from config file when flags and env are absent', async () => {
        mockReadConfig.mockResolvedValue({ apiKey: 'config-key', zone: 'eu1.make.com' });
        const result = await resolveAuth({});
        expect(result).toEqual({ token: 'config-key', zone: 'eu1.make.com' });
    });

    it('should prefer flags over config file', async () => {
        mockReadConfig.mockResolvedValue({ apiKey: 'config-key', zone: 'eu1.make.com' });
        const result = await resolveAuth({ apiKey: 'flag-key', zone: 'eu2.make.com' });
        expect(result).toEqual({ token: 'flag-key', zone: 'eu2.make.com' });
        expect(mockReadConfig).not.toHaveBeenCalled();
    });

    it('should prefer env vars over config file', async () => {
        process.env.MAKE_API_KEY = 'env-key';
        process.env.MAKE_ZONE = 'eu2.make.com';
        mockReadConfig.mockResolvedValue({ apiKey: 'config-key', zone: 'eu1.make.com' });
        const result = await resolveAuth({});
        expect(result).toEqual({ token: 'env-key', zone: 'eu2.make.com' });
        expect(mockReadConfig).not.toHaveBeenCalled();
    });

    it('should throw with updated message when all tiers are missing', async () => {
        mockReadConfig.mockResolvedValue(null);
        await expect(resolveAuth({})).rejects.toThrow('make-cli login');
    });

    it('should not read config and throw when only token is set via env', async () => {
        process.env.MAKE_API_KEY = 'env-key';
        await expect(resolveAuth({})).rejects.toThrow('Zone is required');
        expect(mockReadConfig).not.toHaveBeenCalled();
    });

    it('should not read config and throw when only zone is set via env', async () => {
        process.env.MAKE_ZONE = 'eu1.make.com';
        await expect(resolveAuth({})).rejects.toThrow('API key is required');
        expect(mockReadConfig).not.toHaveBeenCalled();
    });

    it('should not read config when both token and zone are resolved from flags/env', async () => {
        const result = await resolveAuth({ apiKey: 'flag-key', zone: 'eu1.make.com' });
        expect(result).toEqual({ token: 'flag-key', zone: 'eu1.make.com' });
        expect(mockReadConfig).not.toHaveBeenCalled();
    });
});
