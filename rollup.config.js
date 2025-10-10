import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import ts from 'typescript';

const isDev = process.env.NODE_ENV === 'development';

const baseConfig = {
    input: 'src/core/Sankey.ts',
    external: ['d3'], // D3 is external dependency
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

// CSS build configuration
const cssConfig = {
    input: 'src/styles/index.css',
    plugins: [
        postcss({
            plugins: [
                postcssImport()
            ],
            extract: 'styles.css',
            minimize: true,
            sourceMap: true
        })
    ],
    output: {
        file: 'dist/temp-unused.js', // This file won't be used since we're extracting CSS
        format: 'es'
    }
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
        name: 'energy-visualization-sankey',
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
        name: 'energy-visualization-sankey',
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

// Standalone builds (include D3)
const standaloneBaseConfig = {
    input: 'src/core/Sankey.ts',
    external: [], // Include D3 in standalone builds
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: false, // Only generate types once
            clean: true,
            abortOnError: false,
            rollupCommonJSResolveHack: false,
            typescript: ts
        })
    ]
};

const standaloneEsmConfig = {
    ...standaloneBaseConfig,
    output: {
        file: 'dist/sankey.standalone.esm.js',
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
    }
};

const standaloneUmdConfig = {
    ...standaloneBaseConfig,
    output: {
        file: 'dist/sankey.standalone.umd.js',
        format: 'umd',
        name: 'energy-visualization-sankey',
        sourcemap: true,
        inlineDynamicImports: true
    }
};

const standaloneMinConfig = {
    ...standaloneBaseConfig,
    output: {
        file: 'dist/sankey.standalone.min.js',
        format: 'umd',
        name: 'energy-visualization-sankey',
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        ...standaloneBaseConfig.plugins,
        terser()
    ]
};

// Export appropriate configs based on environment
export default isDev
    ? [cssConfig, esmConfig, umdConfig, standaloneEsmConfig, standaloneUmdConfig] // Include standalone versions for dev testing
    : [cssConfig, esmConfig, umdConfig, umdMinConfig, standaloneEsmConfig, standaloneUmdConfig, standaloneMinConfig];
