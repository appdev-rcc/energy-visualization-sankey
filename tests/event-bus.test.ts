/**
 * EventBus behaviours the public event API depends on
 *
 * These are not incidental implementation details: each one directly justifies a
 * design decision in Sankey's on()/once()/off() and in the `events` constructor
 * option. If one of these changes, the public API has to change with it.
 */

import {EventBus} from '@/core/events/EventBus';
import type {SankeyEvent, SankeyEventType} from '@/core/types/events';
import type {SankeyOptions} from '@/types';
import {Logger} from '@/utils/Logger';

const makeBus = (): EventBus => new EventBus(new Logger({data: [], country: 'US'} as SankeyOptions));

const evt = (type: SankeyEventType, data: any): SankeyEvent<any> => ({
    type,
    timestamp: Date.now(),
    source: 'test',
    data
});

/** Dispatch happens in a microtask, so one turn of the queue is enough here. */
const drain = (): Promise<void> => Promise.resolve();

describe('EventBus', () => {
    describe('dispatch timing', () => {
        it('should dispatch on a microtask rather than synchronously', async () => {
            const bus = makeBus();
            const seen: number[] = [];
            bus.subscribe('year.changed', (event) => {
                seen.push(event.data.year);
            });

            bus.emit(evt('year.changed', {year: 1900}));
            expect(seen).toEqual([]);

            await drain();
            expect(seen).toEqual([1900]);
        });
    });

    describe('delivery guarantees', () => {
        // This is why the `events` constructor option exists: a handler attached
        // after initialization has already emitted 'system.ready' never sees it.
        it('should silently drop events that have no subscriber, with no replay', async () => {
            const bus = makeBus();
            bus.emit(evt('system.ready', {totalInitTime: 1, dataPointCount: 1, yearRange: [1800, 2021]}));

            const late = jest.fn();
            bus.subscribe('system.ready', late);
            await drain();

            expect(late).not.toHaveBeenCalled();
        });

        it('should isolate a handler that throws from the other handlers', async () => {
            const bus = makeBus();
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const survivor = jest.fn();

            bus.subscribe('year.changed', () => {
                throw new Error('boom');
            });
            bus.subscribe('year.changed', survivor);

            bus.emit(evt('year.changed', {year: 1900}));
            await drain();

            expect(survivor).toHaveBeenCalledTimes(1);
            consoleError.mockRestore();
        });
    });

    describe('handler identity deduplication', () => {
        // REGRESSION GUARD for the wrapper closure in Sankey.addListener().
        // The bus stores handlers in a Set keyed by function identity, so the
        // same reference registered twice collapses to one entry and a single
        // unsubscribe silently removes both logical subscriptions.
        it('should collapse an identical handler reference into one Set entry', async () => {
            const bus = makeBus();
            const handler = jest.fn();

            const first = bus.subscribe('year.changed', handler);
            bus.subscribe('year.changed', handler);

            bus.unsubscribe(first);
            bus.emit(evt('year.changed', {year: 1900}));
            await drain();

            expect(handler).not.toHaveBeenCalled();
        });

        it('should keep distinct closures independently removable', async () => {
            const bus = makeBus();
            const handler = jest.fn();

            const first = bus.subscribe('year.changed', (event) => handler(event));
            bus.subscribe('year.changed', (event) => handler(event));

            bus.unsubscribe(first);
            bus.emit(evt('year.changed', {year: 1900}));
            await drain();

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('clear', () => {
        it('should stop delivery for handlers registered before the call', async () => {
            const bus = makeBus();
            const handler = jest.fn();
            bus.subscribe('year.changed', handler);

            bus.clear();
            bus.emit(evt('year.changed', {year: 1900}));
            await drain();

            expect(handler).not.toHaveBeenCalled();
        });

        // Documents why 'system.error' still reaches handlers even though
        // handleInitializationError() calls destroy() right after emitting.
        it('should still deliver an emit that was already in flight', async () => {
            const bus = makeBus();
            const handler = jest.fn();
            bus.subscribe('system.error', handler);

            bus.emit(evt('system.error', {error: new Error('x'), context: 'initialization', recoverable: false}));
            bus.clear();
            await drain();

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });
});
