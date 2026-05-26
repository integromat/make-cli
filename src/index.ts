import { Command, Option } from 'commander';
import { MakeTools } from '@makehq/sdk/tools';
import { buildCommands } from './commands.js';
import { registerIconCommands } from './icon-commands.js';
import { registerVisibilityCommands } from './visibility-commands.js';
import { registerLoginCommands } from './login.js';

declare const __VERSION__: string;

const program = new Command();

program
    .name('make-cli')
    .description('A command-line tool for Make automation platform')
    .version(__VERSION__)
    .option('--api-key <key>', 'Make API key (or set MAKE_API_KEY)')
    .option('--zone <zone>', 'Make zone, e.g. eu1.make.com (or set MAKE_ZONE)')
    .addOption(new Option('--output <format>', 'Output format').choices(['json', 'compact', 'table']).default('json'));

buildCommands(program, MakeTools);
registerIconCommands(program);
registerVisibilityCommands(program);
registerLoginCommands(program);

program.parseAsync(process.argv).catch(err => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
});
