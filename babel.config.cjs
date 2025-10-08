module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    node: 'current',
                },
                modules: 'cjs' // Convert ES modules to CommonJS for Jest
            },
        ],
    ],
    env: {
        test: {
            presets: [
                [
                    '@babel/preset-env',
                    {
                        targets: {
                            node: 'current',
                        },
                        modules: 'cjs'
                    },
                ],
            ],
        },
    },
};
