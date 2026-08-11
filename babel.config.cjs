const presets = [
    [
        '@babel/preset-env',
        {
            targets: {
                node: 'current',
            },
            modules: 'cjs' // Convert ES modules to CommonJS for Jest
        },
    ],
    // Listed after preset-env because Babel applies presets in reverse array
    // order, so type stripping runs first. Strips types only - it has no type
    // information, so a green Jest run does not imply the types are correct.
    // `npm run type-check` remains the type gate.
    '@babel/preset-typescript',
];

module.exports = {
    presets,
    env: {
        test: {
            presets,
        },
    },
};
