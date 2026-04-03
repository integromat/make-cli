import { readConfig } from './config.js';

export async function resolveAuth(options: { apiKey?: string; zone?: string }): Promise<{ token: string; zone: string }> {
    let token = options.apiKey ?? process.env.MAKE_API_KEY;
    let zone = options.zone ?? process.env.MAKE_ZONE;

    if (!token && !zone) {
        const config = await readConfig();
        if (config) {
            token = config.apiKey;
            zone = config.zone;
        }
    }

    if (!token) {
        throw new Error('API key is required. Use --api-key, set MAKE_API_KEY, or run "make-cli login".');
    }
    if (!zone) {
        throw new Error('Zone is required. Use --zone, set MAKE_ZONE, or run "make-cli login".');
    }

    return { token, zone };
}
