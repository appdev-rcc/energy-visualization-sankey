/**
 * Public event API of the Sankey visualization
 *
 * Exercises the real class against the real dataset in jsdom, rather than the
 * hand-written mocks used by numerical-validation.test.js.
 */

import * as fs from 'fs';
import * as path from 'path';

import Sankey from '@/core/Sankey';
import type {EnergyDataPoint, SankeyOptions} from '@/types';

const actualData: EnergyDataPoint[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../examples/data/us.json'), 'utf8')
);

/**
 * initialize() chains several awaits before emitting 'system.ready', so a single
 * `await Promise.resolve()` is not enough to observe it. A macrotask turn drains
 * the whole chain.
 */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * An explicit width keeps assertions deterministic: getBoundingClientRect()
 * returns 0 under jsdom, which would otherwise fall through to a default.
 */
const baseOptions = (overrides: Partial<SankeyOptions> = {}): SankeyOptions => ({
    data: actualData,
    country: 'US',
    width: 1400,
    ...overrides
} as SankeyOptions);

describe('Sankey public event API', () => {
    let sankey: Sankey | null = null;

    beforeEach(() => {
        document.body.innerHTML = '<div id="sankey"></div>';
    });

    afterEach(() => {
        sankey?.destroy();
        sankey = null;
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    describe('events constructor option', () => {
        it('should deliver system.ready, which a later subscription would miss', async () => {
            const onReady = jest.fn();
            sankey = new Sankey('sankey', baseOptions({events: {'system.ready': onReady}}));

            await flush();

            expect(onReady).toHaveBeenCalledTimes(1);
            const event = onReady.mock.calls[0][0];
            expect(event.type).toBe('system.ready');
            expect(event.data.dataPointCount).toBe(actualData.length);
            expect(event.data.yearRange).toEqual([1800, 2021]);
            expect(typeof event.data.totalInitTime).toBe('number');
        });

        it('should ignore a non-function entry rather than throwing', async () => {
            sankey = new Sankey('sankey', baseOptions({events: {'system.ready': undefined}}));
            await flush();

            expect(sankey.isInitialized()).toBe(true);
        });
    });

    describe('whenReady', () => {
        it('should resolve for a caller that awaits it after initialization finished', async () => {
            sankey = new Sankey('sankey', baseOptions());

            // Deliberately let initialization complete before touching the latch.
            await flush();
            await flush();

            const event = await sankey.whenReady();
            expect(event.type).toBe('system.ready');
            expect(event.data.dataPointCount).toBe(actualData.length);
        });

        it('should reject when the instance is destroyed before it becomes ready', async () => {
            sankey = new Sankey('sankey', baseOptions());
            const pending = sankey.whenReady();

            sankey.destroy();

            await expect(pending).rejects.toThrow(/destroyed before initialization/);
            sankey = null;
        });
    });

    describe('on', () => {
        it('should deliver year.changed with isAnimating false for a programmatic change', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            sankey.on('year.changed', handler);

            const years = sankey.getYears();
            sankey.setYear(years[5]);
            await flush();

            expect(handler).toHaveBeenCalledTimes(1);
            const {data} = handler.mock.calls[0][0];
            expect(data.year).toBe(years[5]);
            expect(data.yearIndex).toBe(5);
            expect(data.isAnimating).toBe(false);
        });

        it('should register the same handler reference twice and call it twice', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            const stopFirst = sankey.on('year.changed', handler);
            sankey.on('year.changed', handler);

            const years = sankey.getYears();
            sankey.setYear(years[1]);
            await flush();
            expect(handler).toHaveBeenCalledTimes(2);

            // The bus dedupes by function identity, so this only works because
            // each registration is wrapped in its own closure.
            handler.mockClear();
            stopFirst();
            sankey.setYear(years[2]);
            await flush();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should return an unsubscribe function that is safe to call twice', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            const stop = sankey.on('year.changed', handler);
            const years = sankey.getYears();

            stop();
            expect(() => stop()).not.toThrow();

            sankey.setYear(years[3]);
            await flush();
            expect(handler).not.toHaveBeenCalled();
        });

        it('should not let a throwing handler break the visualization', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const survivor = jest.fn();
            sankey.on('year.changed', () => {
                throw new Error('handler exploded');
            });
            sankey.on('year.changed', survivor);

            const years = sankey.getYears();
            sankey.setYear(years[4]);
            await flush();

            expect(survivor).toHaveBeenCalledTimes(1);
            expect(sankey.getCurrentYear()).toBe(years[4]);
        });
    });

    describe('once', () => {
        it('should fire exactly once across two year changes', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            sankey.once('year.changed', handler);

            const years = sankey.getYears();
            sankey.setYear(years[1]);
            await flush();
            sankey.setYear(years[2]);
            await flush();

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('off', () => {
        it('should remove every registration of a handler for that event', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            sankey.on('year.changed', handler);
            sankey.on('year.changed', handler);
            sankey.off('year.changed', handler);

            const years = sankey.getYears();
            sankey.setYear(years[1]);
            await flush();

            expect(handler).not.toHaveBeenCalled();
        });

        it('should cancel a pending once registration', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            sankey.once('year.changed', handler);
            sankey.off('year.changed', handler);

            const years = sankey.getYears();
            sankey.setYear(years[1]);
            await flush();

            expect(handler).not.toHaveBeenCalled();
        });

        it('should be a no-op for a handler that was never registered', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            expect(() => sankey!.off('year.changed', jest.fn())).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should stop delivering events', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const handler = jest.fn();
            sankey.on('year.changed', handler);

            sankey.destroy();
            await flush();
            handler.mockClear();

            sankey.setYear(1900);
            await flush();
            expect(handler).not.toHaveBeenCalled();

            sankey = null;
        });

        it('should warn and return a no-op unsubscribe when subscribing after destroy', async () => {
            sankey = new Sankey('sankey', baseOptions());
            await flush();

            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            sankey.destroy();

            const stop = sankey.on('year.changed', jest.fn());
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('has been destroyed'));
            expect(() => stop()).not.toThrow();

            sankey = null;
        });
    });

    describe('unhandled rejections', () => {
        // Guards the deliberate no-op .catch() on readyPromise in the
        // constructor. Without it, every destroyed-before-ready instance would
        // surface a fresh unhandled rejection for callers that never awaited.
        it('should not produce an unhandled rejection when destroyed before ready', async () => {
            const onUnhandled = jest.fn();
            process.on('unhandledRejection', onUnhandled);

            try {
                const instance = new Sankey('sankey', baseOptions());
                instance.destroy();

                await flush();
                await flush();

                expect(onUnhandled).not.toHaveBeenCalled();
            } finally {
                process.off('unhandledRejection', onUnhandled);
            }
        });
    });
});
