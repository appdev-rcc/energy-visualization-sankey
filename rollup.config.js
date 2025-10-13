import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import ts from 'typescript';

const isProduction = process.env.NODE_ENV === 'production';

// CSS build configuration
const cssConfig = {
    input: 'src/styles/index.css',
    plugins: [
        postcss({
            plugins: [
                postcssImport()
            ],
            extract: 'sankey.css',
            minimize: isProduction,
            sourceMap: true
        })
    ],
    output: {
        file: 'dist/temp-unused.js', // This file won't be used since we're extracting CSS
        format: 'es'
    }
};

const baseConfig = {
    input: 'src/core/Sankey.ts',
    // Embed D3 in the bundle for standalone distribution
    external: [],
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        typescript({
            tsconfig: './tsconfig.json',
            useTsconfigDeclarationDir: true,
            clean: true,
            abortOnError: false,
            rollupCommonJSResolveHack: false,
            typescript: ts
        })
    ]
};

// ES Module build
const esmConfig = {
    ...baseConfig,
    output: {
        file: 'dist/sankey.esm.js',
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
    }
};

// UMD build
const umdConfig = {
    ...baseConfig,
    output: {
        file: 'dist/sankey.umd.js',
        format: 'umd',
        name: 'Sankey',
        globals: {
            'd3': 'd3'
        },
        sourcemap: true,
        inlineDynamicImports: true
    }
};

// UMD minified build
const umdMinConfig = {
    ...baseConfig,
    output: {
        file: 'dist/sankey.umd.min.js',
        format: 'umd',
        name: 'Sankey',
        globals: {
            'd3': 'd3'
        },
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        ...baseConfig.plugins,
        terser()
    ]
};

// Export appropriate configs based on environment
export default isProduction
    ? [cssConfig, esmConfig, umdConfig, umdMinConfig]
    : [cssConfig, esmConfig, umdConfig];
