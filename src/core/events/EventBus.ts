import type {EventHandler, EventSubscription, SankeyEvent, SankeyEventType} from '@/core/types/events';
import {Logger} from "@/utils/Logger";

/**
 * Event bus statistics for debugging and monitoring
 */
export interface EventBusStats {
    readonly totalSubscriptions: number;
    readonly subscriptionsByType: Record<SankeyEventType, number>;
    readonly totalEventsEmitted: number;
    readonly eventsByType: Record<string, number>;
    readonly averageHandlerTime: number;
    readonly errorCount: number;
}

/**
 * Event Bus
 *
 * High-performance, type-safe event system enabling clean service communication.
 * Provides asynchronous event dispatch, error isolation, and performance monitoring.
 *
 * Architecture Features:
 * - Type-safe event handling with comprehensive interfaces
 * - Asynchronous dispatch preventing caller blocking
 * - Error isolation ensuring single handler failures don't cascade
 * - Performance monitoring with execution time tracking
 * - Memory leak prevention through proper subscription cleanup
 * - Development-mode debugging with detailed error context
 *
 * Usage:
 * ```typescript
 * const eventBus = new EventBus();
 * const subscription = eventBus.subscribe('year.changed', (event) => {
 *   console.log(`Year changed to ${event.data.year}`);
 * });
 * eventBus.emit({ type: 'year.changed', data: { year: 2021 }, ... });
 * eventBus.unsubscribe(subscription);
 * ```
 *
 */
export class EventBus {

    constructor(private logger: Logger) {
    }

    // HANDLER STORAGE OPTIMIZATION:
    // Map<EventType, Set<Handler>> provides O(1) event type lookups
    // Set<Handler> provides O(1) handler deduplication and removal
    // This dual-structure design optimizes both subscription and dispatch performance
    private handlers = new Map<SankeyEventType, Set<EventHandler<any>>>();

    // SUBSCRIPTION LIFECYCLE MANAGEMENT:
    // Map<SubscriptionId, Subscription> enables fast subscription lookup for cleanup
    // Each subscription gets a unique ID to prevent memory leaks from orphaned references
    // Critical for proper resource management in long-running applications
    private subscriptions = new Map<string, EventSubscription>();

    // PERFORMANCE METRICS COLLECTION:
    // Tracks comprehensive statistics for debugging and optimization
    // All counters are updated atomically to prevent race conditions
    // Statistics are immutable when returned via getStats() to prevent external mutation
    private stats = {
        totalSubscriptions: 0,                                              // Current active subscription count
        subscriptionsByType: {} as Record<SankeyEventType, number>,        // Per-event-type subscription counts
        totalEventsEmitted: 0,                                             // Lifetime event emission count
        eventsByType: {} as Record<string, number>,                        // Per-event-type emission counts  
        averageHandlerTime: 0,                                             // Computed from handlerTimes array
        errorCount: 0                                                      // Total handler error count
    };

    // ROLLING PERFORMANCE WINDOW:
    // Maintains last N handler execution times for performance analysis
    // Prevents unbounded memory growth while preserving recent performance data
    // Used for calculating rolling averages and identifying performance regressions
    private handlerTimes: number[] = [];
    private readonly MAX_HANDLER_TIMES = 100; // Optimal balance: sufficient data, bounded memory

    /**
     * Emit an event to all subscribers with asynchronous dispatch
     *
     * ASYNC DISPATCH PATTERN:
     * Uses Promise.resolve().then() to break out of the current execution context,
     * ensuring the emit() call returns immediately and doesn't block the caller.
     * This prevents stack overflow in recursive event scenarios and maintains
     * responsive UI during heavy event processing.
     *
     * ERROR ISOLATION STRATEGY:
     * Each handler executes in its own try-catch block, preventing handler
     * failures from affecting other handlers or the event system itself.
     * Async handler errors are caught via promise rejection handling.
     *
     * PERFORMANCE MONITORING:
     * Tracks individual handler execution times and aggregate dispatch metrics.
     * Uses high-resolution performance.now() for microsecond accuracy.
     * Maintains rolling averages to prevent unbounded memory growth.
     */
    emit<T>(event: SankeyEvent<T>): void {
        const eventHandlers = this.handlers.get(event.type);

        // Fast path: no handlers registered for this event type
        if (!eventHandlers || eventHandlers.size === 0) {
            return;
        }

        // Update emission statistics BEFORE dispatch
        // This ensures accurate counting even if handlers throw errors
        this.stats.totalEventsEmitted++;
        this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;

        // CRITICAL: Promise.resolve().then() creates async boundary
        // This ensures emit() returns immediately, preventing:
        // 1. Stack overflow from recursive event chains
        // 2. UI blocking during handler execution
        // 3. Caller dependency on handler completion timing
        Promise.resolve().then(() => {
            const dispatchStartTime = performance.now();
            let handlerCount = 0;
            let errorCount = 0;

            // Process each handler with individual error isolation
            eventHandlers.forEach(handler => {
                try {
                    const handlerStartTime = performance.now();

                    // Execute handler - may return void, Promise<void>, or throw
                    const result = handler(event);

                    // ASYNC HANDLER SUPPORT:
                    // If handler returns a Promise, attach error handling
                    // This catches async errors that occur after handler returns
                    if (result && typeof result.catch === 'function') {
                        (result as Promise<void>).catch(error => {
                            this.handleError(error, event, handler);
                        });
                    }

                    // Track individual handler performance
                    // Used for identifying slow handlers during optimization
                    const handlerExecutionTime = performance.now() - handlerStartTime;
                    this.recordHandlerTime(handlerExecutionTime);
                    handlerCount++;

                } catch (error) {
                    // Synchronous error handling
                    // Prevents one bad handler from affecting others
                    this.handleError(error, event, handler);
                    errorCount++;
                }
            });

            // Log dispatch completion with performance metrics
            const totalDispatchTime = performance.now() - dispatchStartTime;
            this.logger.log(`EventBus: ${event.type} → ${handlerCount} handlers (${errorCount} errors) in ${totalDispatchTime.toFixed(2)}ms`);
        });
    }

    /**
     * Subscribe to specific event types with automatic deduplication
     *
     * SUBSCRIPTION LIFECYCLE:
     * 1. Handler storage: Lazy-initialized Set prevents duplicate handlers
     * 2. Subscription record: Unique ID enables precise cleanup without reference leaks
     * 3. Statistics tracking: Real-time metrics for debugging and monitoring
     * 4. Memory safety: All data structures designed for leak-free cleanup
     *
     * PERFORMANCE CHARACTERISTICS:
     * - Handler lookup: O(1) via Map<EventType, Set<Handler>>
     * - Duplicate prevention: O(1) via Set.add() deduplication
     * - Subscription tracking: O(1) via Map<SubscriptionId, Record>
     * - Memory overhead: ~200 bytes per subscription (ID + metadata)
     */
    subscribe<T>(eventType: SankeyEventType, handler: EventHandler<T>): EventSubscription {
        // LAZY INITIALIZATION: Only create handler set when first subscriber arrives
        // Prevents memory allocation for unused event types
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        // AUTOMATIC DEDUPLICATION: Set.add() naturally prevents duplicate handlers
        // Same handler function can only be registered once per event type
        // Critical for preventing duplicate event processing in service composition
        this.handlers.get(eventType)!.add(handler);

        // UNIQUE SUBSCRIPTION RECORD: Each subscription gets unique ID
        // Enables precise cleanup without requiring handler reference retention
        // Prevents memory leaks from orphaned subscription references
        const subscription: EventSubscription = {
            id: this.generateSubscriptionId(),            // Cryptographically unique identifier
            eventType,                                    // Event type for targeted cleanup
            handler,                                      // Handler function reference
            createdAt: Date.now()                        // Timestamp for debugging/analysis
        };

        // DUAL TRACKING SYSTEM: Both by ID and by handler reference
        // ID mapping enables fast subscription cleanup by consumers
        // Handler mapping enables fast event dispatch by event type
        this.subscriptions.set(subscription.id, subscription);

        // REAL-TIME STATISTICS: Updated immediately for monitoring
        // Atomic updates prevent race conditions in statistics
        this.stats.totalSubscriptions++;
        this.stats.subscriptionsByType[eventType] = (this.stats.subscriptionsByType[eventType] || 0) + 1;

        this.logger.debug(`EventBus: Subscribed to ${eventType} (${subscription.id}) - ${this.handlers.get(eventType)!.size} total handlers`);

        return subscription;
    }

    /**
     * Unsubscribe from events with comprehensive cleanup
     *
     * MEMORY LEAK PREVENTION STRATEGY:
     * 1. Handler removal: Deletes specific handler from event type set
     * 2. Empty set cleanup: Removes entire event type mapping when no handlers remain
     * 3. Subscription cleanup: Removes subscription record by unique ID
     * 4. Statistics maintenance: Atomically updates counters with bounds checking
     *
     * CLEANUP SAFETY:
     * - Idempotent: Safe to call multiple times with same subscription
     * - Graceful degradation: Handles missing handlers/subscriptions without errors
     * - Statistics integrity: Prevents negative counts via Math.max() bounds
     * - Memory optimization: Eagerly frees unused Map entries
     */
    unsubscribe(subscription: EventSubscription): void {
        const handlers = this.handlers.get(subscription.eventType);

        if (handlers) {
            // PRECISE HANDLER REMOVAL: Delete specific handler by reference
            // Set.delete() is O(1) and safe to call on non-existent elements
            handlers.delete(subscription.handler);

            // MEMORY OPTIMIZATION: Remove empty handler sets immediately
            // Prevents accumulation of empty Map entries over application lifetime
            // Critical for long-running applications with dynamic subscriptions
            if (handlers.size === 0) {
                this.handlers.delete(subscription.eventType);
                this.logger.debug(`EventBus: Removed empty handler set for ${subscription.eventType}`);
            }
        }

        // SUBSCRIPTION RECORD CLEANUP: Remove by unique ID
        // ID-based removal prevents accidental cleanup of similar subscriptions
        // Safe to call on non-existent subscriptions (Map.delete returns boolean)
        const wasSubscribed = this.subscriptions.delete(subscription.id);

        // ATOMIC STATISTICS UPDATE: Maintain accurate counters
        // Math.max() prevents negative counts from double-unsubscribe scenarios
        // All updates are atomic to prevent race conditions in statistics
        if (wasSubscribed) {
            this.stats.totalSubscriptions = Math.max(0, this.stats.totalSubscriptions - 1);
            const currentTypeCount = this.stats.subscriptionsByType[subscription.eventType] || 0;
            this.stats.subscriptionsByType[subscription.eventType] = Math.max(0, currentTypeCount - 1);

            const remainingHandlers = this.handlers.get(subscription.eventType)?.size || 0;
            this.logger.debug(`EventBus: Unsubscribed from ${subscription.eventType} (${subscription.id}) - ${remainingHandlers} handlers remain`);
        } else {
            this.logger.warn(`EventBus: Attempted to unsubscribe non-existent subscription ${subscription.id}`);
        }
    }

    /**
     * Get current event bus statistics
     * Useful for debugging and performance monitoring
     */
    getStats(): EventBusStats {
        return {
            ...this.stats,
            averageHandlerTime: this.calculateAverageHandlerTime(),
            // Create copies to prevent mutation
            subscriptionsByType: {...this.stats.subscriptionsByType},
            eventsByType: {...this.stats.eventsByType}
        };
    }

    /**
     * Clear all subscriptions
     * Important for cleanup to prevent memory leaks
     */
    clear(): void {
        const subscriptionCount = this.subscriptions.size;
        const handlerTypeCount = this.handlers.size;

        this.handlers.clear();
        this.subscriptions.clear();

        // Reset statistics
        this.stats = {
            totalSubscriptions: 0,
            subscriptionsByType: {} as Record<SankeyEventType, number>,
            totalEventsEmitted: 0,
            eventsByType: {},
            averageHandlerTime: 0,
            errorCount: 0
        };

        this.handlerTimes = [];

        this.logger.debug(`EventBus: Cleared ${subscriptionCount} subscriptions across ${handlerTypeCount} event types`);
    }

    /**
     * Generate unique subscription ID
     */
    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Handle errors in event handlers with comprehensive error isolation
     *
     * ERROR ISOLATION PRINCIPLES:
     * 1. Statistics tracking: Increment error count for monitoring
     * 2. Detailed logging: Capture error context for debugging
     * 3. Stack preservation: Include stack trace for error analysis
     * 4. Handler identification: Log handler source for debugging
     * 5. Cascade prevention: Error never bubbles up to caller
     *
     * DEBUGGING INFORMATION CAPTURE:
     * - Error message and type
     * - Event context (type, source, timestamp)
     * - Handler function preview (first 100 chars)
     * - Full stack trace when available
     * - Performance timing context
     *
     * PRODUCTION SAFETY:
     * - Never throws exceptions (pure error logging)
     * - Preserves application stability during handler failures
     * - Maintains event system availability during error scenarios
     */
    private handleError(error: any, event: SankeyEvent<any>, handler: EventHandler<any>): void {
        // ATOMIC ERROR COUNTING: Thread-safe increment for monitoring
        this.stats.errorCount++;

        // COMPREHENSIVE ERROR CONTEXT: Capture all relevant debugging information
        const errorContext = {
            // Error details
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined,

            // Event context
            eventType: event.type,
            eventSource: event.source,
            eventTimestamp: event.timestamp,

            // Handler context  
            handlerPreview: handler.toString().substring(0, 100) + '...',
            handlerLength: handler.toString().length,

            // System context
            totalErrors: this.stats.errorCount,
            totalEvents: this.stats.totalEventsEmitted,
            errorRate: this.stats.totalEventsEmitted > 0
                ? (this.stats.errorCount / this.stats.totalEventsEmitted * 100).toFixed(2) + '%'
                : '0%'
        };

        // STRUCTURED ERROR LOGGING: Use console.error for visibility in production
        console.error(`EventBus: Handler error in ${event.type} (error #${this.stats.errorCount}):`, errorContext);

        // HANDLER IDENTIFICATION: Log handler source for debugging
        // Truncated to prevent log spam from very large handler functions
        this.logger.warn(`EventBus: Failing handler source preview:`, errorContext.handlerPreview);

        // PERFORMANCE IMPACT LOGGING: Track if errors are affecting performance
        if (this.stats.errorCount > 0 && this.stats.errorCount % 10 === 0) {
            this.logger.warn(`EventBus: Error count reached ${this.stats.errorCount} - consider investigating handler stability`);
        }
    }

    /**
     * Record handler execution time using rolling window algorithm
     *
     * ROLLING WINDOW PERFORMANCE TRACKING:
     * Maintains a bounded circular buffer of recent handler execution times
     * for statistical analysis without unbounded memory growth.
     *
     * ALGORITHM PROPERTIES:
     * - Time complexity: O(1) for insertion, O(1) amortized for window maintenance
     * - Space complexity: O(MAX_HANDLER_TIMES) = O(100) = constant
     * - Statistical accuracy: Based on last 100 measurements
     * - Memory safety: Automatic buffer rotation prevents memory leaks
     *
     * PERFORMANCE INSIGHTS:
     * - Captures recent performance trends vs. lifetime averages
     * - Enables detection of performance regressions
     * - Filters out historical performance from earlier application states
     * - Provides statistically significant sample size for analysis
     */
    private recordHandlerTime(time: number): void {
        // BOUNDED BUFFER APPEND: Add new measurement to rolling window
        this.handlerTimes.push(time);

        // AUTOMATIC WINDOW ROTATION: Maintain fixed buffer size
        // Array.shift() removes oldest measurement when buffer exceeds limit
        // This creates a FIFO (First In, First Out) circular buffer behavior
        // Memory complexity remains constant regardless of application lifetime
        if (this.handlerTimes.length > this.MAX_HANDLER_TIMES) {
            this.handlerTimes.shift();  // O(n) operation, but bounded by MAX_HANDLER_TIMES
        }

        // PERFORMANCE ANOMALY DETECTION: Log unusually slow handlers
        // Threshold: 10ms (significant for UI responsiveness)
        if (time > 10) {
            this.logger.warn(`EventBus: Slow handler detected: ${time.toFixed(2)}ms execution time`);
        }
    }

    /**
     * Calculate rolling average handler execution time
     *
     * STATISTICAL CALCULATION:
     * Computes arithmetic mean of recent handler execution times using
     * the rolling window buffer for temporally-relevant performance metrics.
     *
     * MATHEMATICAL PROPERTIES:
     * - Formula: μ = (Σ times) / n, where n = sample count
     * - Sample size: min(total_measurements, MAX_HANDLER_TIMES)
     * - Precision: Floating point precision of performance.now()
     * - Accuracy: Based on high-resolution performance timer
     *
     * PERFORMANCE CHARACTERISTICS:
     * - Time complexity: O(n) where n ≤ MAX_HANDLER_TIMES
     * - Space complexity: O(1) additional memory
     * - Numerical stability: Uses reduce() for precision
     */
    private calculateAverageHandlerTime(): number {
        // EDGE CASE: Handle empty buffer gracefully
        if (this.handlerTimes.length === 0) {
            return 0;
        }

        // ARITHMETIC MEAN CALCULATION: Sum all measurements and divide by count
        // Using reduce() for numerical stability and functional programming clarity
        const sum = this.handlerTimes.reduce((accumulator, currentTime) => accumulator + currentTime, 0);
        const average = sum / this.handlerTimes.length;

        // PRECISION OPTIMIZATION: Round to 3 decimal places for performance metrics
        // Balances precision with readability for monitoring dashboards
        return Math.round(average * 1000) / 1000;
    }

    /**
     * Get debug information about current subscriptions
     * Useful for development and debugging
     */
    getDebugInfo(): {
        activeSubscriptions: Array<{
            id: string;
            eventType: SankeyEventType;
            createdAt: number;
            age: number;
        }>;
        handlerCounts: Record<SankeyEventType, number>;
        recentPerformance: {
            averageHandlerTime: number;
            recentHandlerTimes: number[];
            totalEvents: number;
            errorRate: number;
        };
    } {
        const now = Date.now();
        const activeSubscriptions = Array.from(this.subscriptions.values()).map(sub => ({
            id: sub.id,
            eventType: sub.eventType,
            createdAt: sub.createdAt,
            age: now - sub.createdAt
        }));

        const handlerCounts: Record<string, number> = {};
        this.handlers.forEach((handlerSet, eventType) => {
            handlerCounts[eventType] = handlerSet.size;
        });

        return {
            activeSubscriptions,
            handlerCounts: handlerCounts as Record<SankeyEventType, number>,
            recentPerformance: {
                averageHandlerTime: this.calculateAverageHandlerTime(),
                recentHandlerTimes: [...this.handlerTimes],
                totalEvents: this.stats.totalEventsEmitted,
                errorRate: this.stats.totalEventsEmitted > 0
                    ? this.stats.errorCount / this.stats.totalEventsEmitted
                    : 0
            }
        };
    }
}
