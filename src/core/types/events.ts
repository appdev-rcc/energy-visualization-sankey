/**
 * Core Event Type Definitions
 *
 * Comprehensive type-safe event system enabling clean service communication.
 * Defines all event types, data structures, and handler interfaces used
 * throughout the visualization system.
 *
 * Event System Architecture:
 * - 20+ typed event channels for service coordination
 * - Asynchronous event dispatch with error isolation
 * - Performance monitoring and debugging support
 * - Memory leak prevention with proper cleanup
 *
 */

/**
 * All possible event types in the Sankey system
 * Each event represents a specific state change or action
 */
export type SankeyEventType =
// Data lifecycle events
    | 'data.loaded'
    | 'data.validated'

    // Calculation events
    | 'calculation.completed'

    // Navigation events
    | 'year.changing'
    | 'year.changed'
    | 'timeline.updated'

    // Animation events
    | 'animation.started'
    | 'animation.stopped'
    | 'speed.changed'

    // Rendering events
    | 'rendering.started'
    | 'rendering.completed'

    // Interaction events
    | 'interaction.hover'
    | 'interaction.click'
    | 'interaction.keypress'
    | 'interaction.slider'
    | 'interaction.button'

    // System events
    | 'system.initialized'
    | 'system.ready'
    | 'system.error'

    // Dimension events
    | 'dimensions.changed';

/**
 * Base event interface - all events extend this
 */
export interface SankeyEvent<T = any> {
    readonly type: SankeyEventType;
    readonly timestamp: number;
    readonly source: string;
    readonly data: T;
}

/**
 * Event handler type definition
 */
export type EventHandler<T = any> = (event: SankeyEvent<T>) => void | Promise<void>;

/**
 * Event subscription interface
 */
export interface EventSubscription {
    readonly id: string;
    readonly eventType: SankeyEventType;
    readonly handler: EventHandler<any>;
    readonly createdAt: number;
}
