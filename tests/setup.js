// Jest setup for US Energy Sankey validation tests
//
// jest-environment-jsdom already supplies document, window, HTMLElement,
// performance and requestAnimationFrame. This file used to build a SECOND JSDOM
// realm and overwrite those globals, which caused two real problems:
//
//   1. Cross-realm `instanceof` failures. Sankey.resolveContainer() checks
//      `containerId instanceof HTMLElement`, and an element created by Jest's
//      document is not an instance of the overwritten global.HTMLElement.
//   2. `resources: 'usable'` made JSDOM issue real network requests for the
//      <img> in Sankey's injected header markup.
//
// Only the encoder polyfills are still needed.

const {TextEncoder, TextDecoder} = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
