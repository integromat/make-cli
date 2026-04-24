import type { Command } from 'commander';
import { Command as CommandClass } from 'commander';
import type { MakeTool, JSONSchema } from '@makehq/sdk/tools';
import type { JSONValue } from '@makehq/sdk';
import { Make } from '@makehq/sdk';
import { MakeError } from '@makehq/sdk';
import { resolveAuth } from './auth.js';
import { formatOutput, type OutputFormat } from './output.js';
import { CATEGORY_TITLES, CATEGORY_GROUPS } from './categories.js';
import { camelToKebab, formatExampleCommand } from './examples.js';

/**
 * Derives the CLI action name from a Make SDK tool name and its category.
 *
 * Tool names follow the pattern `{category}_{action}` where dots in the category
 * are replaced with hyphens (e.g., 'sdk.apps' → 'sdk-apps').
 *
 * Examples:
 *   ('scenarios_list', 'scenarios') → 'list'
 *   ('data-stores_list', 'data-stores') → 'list'
 *   ('sdk-apps_get-section', 'sdk.apps') → 'get-section'
 *   ('credential-requests_list', 'credential-requests') → 'list'
 */
export function deriveActionName(toolName: string, category: string): string {
    const prefix = category.replace(/\./g, '-') + '_';
    return toolName.slice(prefix.length).replace(/_/g, '-');
}

/**
 * Returns the input-schema property name that represents the tool's own
 * resource ID and should be exposed as a positional argument on the CLI.
 * Returns undefined when no positional form should apply.
 *
 * The SDK declares this property via `tool.resourceId`. It is distinct from
 * `tool.scopeId`, which names the parent/scope ID used for routing and
 * access control. A single tool may have both — e.g. `executions_get` has
 * `scopeId = 'scenarioId'` and `resourceId = 'executionId'`, so the command
 * is invoked as `executions get <executionId> --scenario-id=<scenarioId>`.
 *
 * We skip positional registration when:
 *   - `tool.resourceId` is unset (collection-level actions like list/create).
 *   - `tool.resourceId` points at a property that doesn't exist in the schema
 *     (guards against SDK definition drift).
 */
export function deriveSelfIdentifier(tool: MakeTool): string | undefined {
    const resourceId = tool.resourceId;
    if (!resourceId) return undefined;
    const properties = tool.inputSchema.properties ?? {};
    // Use an own-property check so a `resourceId` that happens to match an
    // Object.prototype method name (e.g. `toString`) is not treated as present
    // when the schema doesn't actually declare it.
    return Object.hasOwn(properties, resourceId) ? resourceId : undefined;
}

/**
 * Coerces a CLI string value to the type specified by the JSON Schema.
 */
export function coerceValue(value: string, schema: JSONSchema): JSONValue {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    switch (type) {
        case 'number': {
            const num = Number(value);
            if (isNaN(num)) throw new Error(`Expected a number, got: ${value}`);
            return num;
        }
        case 'boolean':
            return value === 'true' || value === '1';
        case 'object':
        case 'array':
            try {
                const parsed = JSON.parse(value);

                if (type === 'array') {
                    if (!Array.isArray(parsed)) {
                        throw new Error(`Expected JSON array for schema type "array", got: ${value}`);
                    }
                } else {
                    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                        throw new Error(`Expected JSON object for schema type "object", got: ${value}`);
                    }
                }

                return parsed as JSONValue;
            } catch (err) {
                if (err instanceof SyntaxError) {
                    throw new Error(`Expected valid JSON, got: ${value}`);
                }
                throw err;
            }
        default:
            return value;
    }
}

/**
 * Gets or creates a subcommand on a parent command.
 */
function getOrCreateSubcommand(parent: Command, name: string, description: string): Command {
    const existing = parent.commands.find(cmd => cmd.name() === name);
    if (existing) return existing;
    return parent.command(name).description(description);
}

/**
 * Registers a Make SDK tool as a CLI command on a parent Commander command.
 *
 * When the tool declares a `resourceId` that points at a schema property, the
 * command exposes that value both as a long-form flag (e.g.
 * `--data-structure-id=178`) and as an optional positional argument (e.g.
 * `data-structures get 178`). The positional is marked optional in Commander
 * so either invocation style parses cleanly; we then enforce presence
 * (when the schema requires it) and reject ambiguous duplication ourselves.
 */
function registerToolAsCommand(parent: Command, tool: MakeTool, category: string): void {
    const actionName = deriveActionName(tool.name, category);
    const cmd = parent.command(actionName).description(tool.description);

    const properties = tool.inputSchema.properties ?? {};
    const required = new Set(tool.inputSchema.required ?? []);
    const selfIdProperty = deriveSelfIdentifier(tool);
    const selfIdSchema = selfIdProperty ? properties[selfIdProperty] : undefined;
    const selfIdRequired = selfIdProperty ? required.has(selfIdProperty) : false;
    const selfIdFlag = selfIdProperty ? `--${camelToKebab(selfIdProperty)}` : undefined;

    for (const [propName, schema] of Object.entries(properties)) {
        const flagName = camelToKebab(propName);
        const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

        const isRequired = required.has(propName);
        const isBooleanFlag = type === 'boolean';
        const isSelfId = propName === selfIdProperty;

        const flag = isBooleanFlag
            ? schema.default === true
                ? `--no-${flagName}`
                : `--${flagName}`
            : `--${flagName} <value>`;

        const option = cmd.createOption(flag, schema.description ?? '');

        // Self-id properties accept either the flag or the positional argument,
        // so we deliberately skip Commander's built-in required-flag check and
        // do our own validation in the action (see below).
        if (isRequired && !isBooleanFlag && !isSelfId) {
            option.makeOptionMandatory(true);
        }
        if (schema.enum) {
            option.choices(schema.enum.map(String));
        }

        if (schema.default !== undefined) {
            option.default(schema.default);
        }

        cmd.addOption(option);
    }

    if (selfIdProperty) {
        const argName = camelToKebab(selfIdProperty);
        cmd.argument(`[${argName}]`, selfIdSchema?.description ?? '');
    }

    const example = tool.examples?.[0];
    if (example && Object.keys(example).length > 0) {
        const slug = category.replace(/\./g, '-');
        const exampleCmd = formatExampleCommand(`make-cli ${slug} ${actionName}`, example, selfIdProperty);
        const indented = exampleCmd
            .split('\n')
            .map(l => '  ' + l)
            .join('\n');
        cmd.addHelpText('after', `\nExample:\n\n${indented}\n`);
    }

    const handler = async (positional: string | undefined, localOptions: Record<string, string>): Promise<void> => {
        if (selfIdProperty && selfIdFlag) {
            const fromFlag = localOptions[selfIdProperty];
            if (positional !== undefined && fromFlag !== undefined) {
                process.stderr.write(
                    `Error: ${selfIdFlag} was supplied both positionally and as a flag; pass it only one way.\n`,
                );
                process.exit(1);
            }
            if (positional === undefined && fromFlag === undefined && selfIdRequired) {
                process.stderr.write(
                    `Error: missing required argument — pass the resource ID positionally or via ${selfIdFlag}.\n`,
                );
                process.exit(1);
            }
        }

        const globalOptions = cmd.optsWithGlobals();
        const { token, zone } = await resolveAuth({
            apiKey: globalOptions.apiKey,
            zone: globalOptions.zone,
        });

        const make = new Make(token, zone);
        const args: Record<string, JSONValue> = {};

        for (const [key, value] of Object.entries(localOptions)) {
            if (value === undefined) continue;
            const schema = properties[key];
            if (schema) {
                args[key] = coerceValue(String(value), schema);
            } else {
                args[key] = value;
            }
        }

        if (selfIdProperty && positional !== undefined && selfIdSchema) {
            args[selfIdProperty] = coerceValue(positional, selfIdSchema);
        }

        try {
            const result = await tool.execute(make, args);
            const format = (globalOptions.output as OutputFormat) ?? 'json';
            process.stdout.write(formatOutput(result, format) + '\n');
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
    };

    if (selfIdProperty) {
        cmd.action((positional: string | undefined, localOptions: Record<string, string>) =>
            handler(positional, localOptions),
        );
    } else {
        cmd.action((localOptions: Record<string, string>) => handler(undefined, localOptions));
    }
}

/**
 * Builds all CLI commands from Make SDK tool definitions.
 * Groups tools by category and creates nested subcommands.
 */
export function buildCommands(program: Command, tools: MakeTool[]): void {
    const categories = new Map<string, MakeTool[]>();

    for (const tool of tools) {
        const group = categories.get(tool.category) ?? [];
        group.push(tool);
        categories.set(tool.category, group);
    }

    for (const [category, categoryTools] of categories) {
        const categoryCommand = getOrCreateSubcommand(
            program,
            category,
            CATEGORY_TITLES[category] ?? `${category} commands`,
        );
        const group = CATEGORY_GROUPS[category];
        if (group) categoryCommand.helpGroup(group);

        for (const tool of categoryTools) {
            registerToolAsCommand(categoryCommand, tool, category);
        }
    }

    program.addHelpCommand(
        new CommandClass('help [command]').description('Display help for command').helpGroup('Others:'),
    );
}
