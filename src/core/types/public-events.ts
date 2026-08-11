/**
 * Public Event Type Definitions
 *
 * The curated, consumer-facing subset of the internal event system. Everything
 * declared here is part of the published API surface and is covered by semver.
 * The internal union in ./events.ts is NOT: it carries service-coordination
 * channels and several declared-but-never-emitted types.
 *
 * Deliberately excluded from the public map:
 * - 'system.initialized'  Three unrelated payloads from three sources
 *                         (Sankey, ConfigurationService, InteractionService), two
 *                         of which fire synchronously inside the constructor. The
 *                         Sankey payload is {services: [], initTime: 0} - both
 *                         fields are permanently dead. Use 'system.ready'.
 * - 'data.loaded'         Payload embeds a full copy of the dataset. Handing that
 *                         to an analytics layer invites someone serializing it.
 * - 'data.validated'      Internal; 'system.ready' carries the same metadata.
 * - 'rendering.completed' Fires exactly once per instance, immediately before
 *                         'system.ready', which carries strictly better data.
 * - 'calculation.completed', 'year.changing', 'timeline.updated',
 *   'rendering.started', 'dimensions.changed'
 *                         Declared in SankeyEventType but never emitted anywhere.
 *                         Publishing a typed key for an event that never fires is
 *                         a promise the library does not keep.
 *
 * Adding a key to SankeyEventMap later is purely additive, so this map starts
 * narrow on purpose.
 */

import type {SankeyEventType} from '@/core/types/events';

/** Classification of the SVG element under the pointer. */
export type SankeyElementType = 'flow' | 'box';

/** Viewport coordinates of a pointer interaction. */
export interface SankeyMousePosition {
    readonly x: number;
    readonly y: number;
}

/** Payload of `system.ready`. Emitted once, after the first frame is rendered. */
export interface SankeyReadyEventData {
    /** Wall-clock milliseconds from construction to first rendered frame. */
    readonly totalInitTime: number;
    readonly dataPointCount: number;
    /** Earliest and latest year present in the dataset. */
    readonly yearRange: readonly [number, number];
}

/** Payload of `system.error`. */
export interface SankeyErrorEventData {
    readonly error: Error;
    readonly context: 'initialization' | 'data_validation';
    readonly recoverable: boolean;
}

/**
 * Payload of `year.changed`.
 *
 * `isAnimating` distinguishes a user scrubbing the timeline from the animation
 * advancing on its own. A full playthrough emits one event per year in the
 * dataset, so analytics consumers should filter on this flag rather than
 * forwarding every occurrence.
 */
export interface SankeyYearChangedEventData {
    readonly year: number;
    readonly previousYear: number;
    readonly yearIndex: number;
    readonly isAnimating: boolean;
}

/** Payload of `animation.started` and `animation.stopped`. */
export interface SankeyAnimationEventData {
    readonly isPlaying: boolean;
    readonly currentYear: number;
    /** Milliseconds per year. */
    readonly speed: number;
}

/** Payload of `speed.changed`. */
export interface SankeySpeedChangedEventData {
    readonly speed: number;
}

/**
 * Payload of `interaction.hover` and `interaction.click`.
 *
 * `fuel` and `sector` are read from the `data-fuel` / `data-sector` attributes
 * and are genuinely null for elements that do not carry them.
 */
export interface SankeyElementInteractionEventData {
    readonly elementType: SankeyElementType;
    readonly fuel: string | null;
    readonly sector: string | null;
    readonly mousePosition: SankeyMousePosition;
}

/** Payload of `interaction.keypress`. */
export interface SankeyKeypressEventData {
    readonly key: string;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
}

/** Payload of `interaction.slider`. */
export interface SankeySliderEventData {
    readonly year: number;
    /** Duplicate of `year`, retained for backwards compatibility. */
    readonly value: number;
}

/**
 * Payload of `interaction.button`. Discriminated on `action`, which is a literal
 * at both emit sites.
 */
export type SankeyButtonEventData =
    | {
    readonly buttonId: 'evs-play-button';
    readonly action: 'play' | 'pause';
    /** Never present for play/pause. Declared so `data.speed` reads without narrowing. */
    readonly speed?: undefined;
}
    | {
    readonly buttonId: string;
    readonly action: 'speed-change';
    readonly speed: number;
};

/** Maps every public event type to its payload. */
export interface SankeyEventMap {
    'system.ready': SankeyReadyEventData;
    'system.error': SankeyErrorEventData;
    'year.changed': SankeyYearChangedEventData;
    'animation.started': SankeyAnimationEventData;
    'animation.stopped': SankeyAnimationEventData;
    'speed.changed': SankeySpeedChangedEventData;
    /** High frequency: fires on every mouseover. Debounce or sample before forwarding. */
    'interaction.hover': SankeyElementInteractionEventData;
    'interaction.click': SankeyElementInteractionEventData;
    'interaction.keypress': SankeyKeypressEventData;
    'interaction.slider': SankeySliderEventData;
    'interaction.button': SankeyButtonEventData;
}

/** Name of a public event. */
export type SankeyPublicEventType = keyof SankeyEventMap;

/**
 * Event envelope.
 *
 * Distributive on purpose: the defaulted `SankeyPublicEvent` is a discriminated
 * union, so a generic forwarder can `switch (event.type)` and narrow
 * `event.data`. A plain generic interface would collapse to
 * `{type: <every key>, data: <union of every payload>}`, which cannot narrow.
 */
export type SankeyPublicEvent<K extends SankeyPublicEventType = SankeyPublicEventType> =
    K extends SankeyPublicEventType
        ? {
            readonly type: K;
            readonly timestamp: number;
            /** Emitting component, e.g. 'InteractionService'. Diagnostic only; not stable. */
            readonly source: string;
            readonly data: SankeyEventMap[K];
        }
        : never;

/**
 * Handler for a single public event type.
 *
 * Handlers are error-isolated: a throw cannot break the visualization or stop
 * other handlers. A returned promise's rejection is caught and logged.
 */
export type SankeyEventListener<K extends SankeyPublicEventType = SankeyPublicEventType> =
    (event: SankeyPublicEvent<K>) => void | Promise<void>;

/** Returned by `on()` and `once()`. Idempotent. */
export type SankeyUnsubscribe = () => void;

/** Shape of the `events` constructor option. */
export type SankeyEventHandlers = {
    readonly [K in SankeyPublicEventType]?: SankeyEventListener<K>;
};

// Compile-time guard: every public key must be a real internal event type.
// Only `npm run type-check` catches a violation - rollup runs the TypeScript
// plugin with abortOnError: false, so the build stays green regardless.
type Assert<T extends true> = T;
type _PublicKeysAreInternal = Assert<SankeyPublicEventType extends SankeyEventType ? true : false>;
