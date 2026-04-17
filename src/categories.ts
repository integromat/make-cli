/**
 * Optional help group headings for top-level command categories.
 * Commands without an entry appear under the default "Commands:" heading.
 */
export const CATEGORY_GROUPS: Record<string, string> = {
    connections: 'Credentials:',
    'credential-requests': 'Credentials:',
    keys: 'Credentials:',
    scenarios: 'Scenarios:',
    executions: 'Scenarios:',
    'incomplete-executions': 'Scenarios:',
    folders: 'Scenarios:',
    functions: 'Scenarios:',
    hooks: 'Scenarios:',
    devices: 'Scenarios:',
    'data-structures': 'Scenarios:',
    'data-stores': 'Data stores:',
    'data-store-records': 'Data stores:',
    teams: 'Account management:',
    organizations: 'Account management:',
    users: 'Account management:',
    enums: 'Others:',
    // SDK categories
    'sdk-apps': 'Custom app development:',
    'sdk-connections': 'Custom app development:',
    'sdk-functions': 'Custom app development:',
    'sdk-modules': 'Custom app development:',
    'sdk-rpcs': 'Custom app development:',
    'sdk-webhooks': 'Custom app development:',
};

export const CATEGORY_TITLES: Record<string, string> = {
    // Top-level categories
    connections: 'Connections',
    'credential-requests': 'Credential requests',
    'data-store-records': 'Data store records',
    'data-stores': 'Data stores',
    'data-structures': 'Data structures',
    enums: 'Shared enumerations',
    executions: 'Scenario executions',
    folders: 'Scenario folders',
    functions: 'Custom functions',
    hooks: 'Webhooks',
    devices: 'Devices',
    'incomplete-executions': 'Incomplete executions',
    keys: 'Keys',
    organizations: 'Organizations',
    scenarios: 'Scenarios',
    teams: 'Teams',
    users: 'Users',
    // SDK categories
    'sdk-apps': 'App definitions',
    'sdk-connections': 'App connections',
    'sdk-functions': 'App functions',
    'sdk-modules': 'App modules',
    'sdk-rpcs': 'App remote procedures',
    'sdk-webhooks': 'App webhooks',
};
