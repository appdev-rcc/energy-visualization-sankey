// Jest setup for US Energy Sankey validation tests

// Polyfills for JSDOM environment
const {TextEncoder, TextDecoder} = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const {JSDOM} = require('jsdom');

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-container"></div></body></html>', {
    pretendToBeVisual: true,
    resources: 'usable',
    url: 'http://localhost'
});

// Make DOM available globally
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLOutputElement = dom.window.HTMLOutputElement;
global.SVGSVGElement = dom.window.SVGSVGElement;
global.SVGElement = dom.window.SVGElement;

// Mock performance API for Node.js
global.performance = {
    now: () => Date.now(),
    timing: {},
    memory: {
        usedJSHeapSize: 1024 * 1024 * 10, // 10MB mock
        totalJSHeapSize: 1024 * 1024 * 50, // 50MB mock
        jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB mock
    }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn()
// };
