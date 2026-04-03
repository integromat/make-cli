import { confirm, input, password, select } from '@inquirer/prompts';
import type { Command } from 'commander';
import { Make, MakeError } from '@makehq/sdk';
import { deleteConfig, getConfigPath, readConfig, writeConfig } from './config.js';
import { resolveAuth } from './auth.js';
import { formatOutput, type OutputFormat } from './output.js';

const ZONE_CHOICES = [
    { name: 'EU1 - Europe', value: 'eu1.make.com' },
    { name: 'EU2 - Europe', value: 'eu2.make.com' },
    { name: 'US1 - United States', value: 'us1.make.com' },
    { name: 'US2 - United States', value: 'us2.make.com' },
    { name: 'Other / Private Instance', value: 'custom' },
];

function normalizeZone(raw: string): string {
    return raw
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
}

export function registerLoginCommands(program: Command): void {
    program
        .command('login')
        .description('Log in to Make by saving your API key locally')
        .helpGroup('Others:')
        .action(async () => {
            let zone = await select({ message: 'Select your Make zone:', choices: ZONE_CHOICES });

            if (zone === 'custom') {
                const raw = await input({ message: 'Enter your zone (e.g. eu1.make.com):' });
                zone = normalizeZone(raw);
                if (!zone) {
                    process.stderr.write('Error: Zone cannot be empty.\n');
                    process.exit(1);
                }
            }

            const hasKey = await confirm({ message: 'Do you already have a Make API key?' });

            if (!hasKey) {
                const url = `https://${zone}/user/api`;
                process.stdout.write(`\nOpening browser to create an API key...\n`);

                try {
                    const { default: open } = await import('open');
                    await open(url);
                } catch {
                    // headless or CI environment — fall through to manual URL
                }

                process.stdout.write(`If the browser didn't open, visit: ${url}\n\n`);
            }

            const apiKey = await password({ message: 'Paste your API key:' });
            if (!apiKey) {
                process.stderr.write('Error: API key cannot be empty.\n');
                process.exit(1);
            }

            process.stdout.write('Validating credentials...\n');

            try {
                const make = new Make(apiKey, zone);
                const user = await make.users.me();
                await writeConfig({ apiKey, zone });
                process.stdout.write(`Logged in as ${user.name} (${user.email})\n`);
                process.stdout.write(`Credentials saved to ${getConfigPath()}\n`);
            } catch (error) {
                if (error instanceof MakeError) {
                    process.stderr.write(`Error [${error.statusCode}]: ${error.message}\n`);
                } else if (error instanceof Error) {
                    process.stderr.write(`Error: ${error.message}\n`);
                } else {
                    process.stderr.write(`Unknown error: ${String(error)}\n`);
                }
                process.exit(1);
            }
        });

    program
        .command('logout')
        .description('Log out of Make by removing saved credentials')
        .helpGroup('Others:')
        .action(async () => {
            const config = await readConfig();
            if (!config) {
                process.stdout.write('Not logged in.\n');
                process.exit(0);
            }
            await deleteConfig();
            process.stdout.write(`Logged out. Credentials removed from ${getConfigPath()}\n`);
        });

    program
        .command('whoami')
        .description('Show the currently authenticated Make user')
        .helpGroup('Others:')
        .action(async () => {
            const globalOptions = program.opts();
            let auth: { token: string; zone: string };
            try {
                auth = await resolveAuth({ apiKey: globalOptions.apiKey, zone: globalOptions.zone });
            } catch (error) {
                process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
                process.exit(1);
            }

            try {
                const make = new Make(auth.token, auth.zone);
                const user = await make.users.me();
                const format = (globalOptions.output as OutputFormat) ?? 'json';
                process.stdout.write(formatOutput({ name: user.name, email: user.email, zone: auth.zone }, format) + '\n');
            } catch (error) {
                if (error instanceof MakeError) {
                    process.stderr.write(`Error [${error.statusCode}]: ${error.message}\n`);
                    process.exit(2);
                } else if (error instanceof Error) {
                    process.stderr.write(`Error: ${error.message}\n`);
                    process.exit(1);
                } else {
                    process.stderr.write(`Unknown error: ${String(error)}\n`);
                    process.exit(1);
                }
            }
        });
}
