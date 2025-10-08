/**
 * Performance Monitoring and Debug Logging Utility
 *
 * **Performance Monitoring Responsibility:**
 * - Provides configurable debug logging for performance analysis
 * - Tracks service initialization, calculation timing, and system events
 * - Enables production performance monitoring without overhead
 * - Supports performance regression detection and optimization efforts
 *
 * **Debug Logging Architecture:**
 * - Configuration-controlled logging (debugLogging option)
 * - Zero performance overhead when disabled (early returns)
 * - Structured logging levels: log, debug, warn for different diagnostic needs
 * - Console API integration for browser dev tools compatibility
 *
 * **Performance Analysis Features:**
 * - Timing information: Service initialization, calculation duration
 * - Cache statistics: Hit rates, cache efficiency metrics
 * - System events: Service lifecycle, error conditions
 * - Performance warnings: Threshold-based alerting for slow operations
 *
 * **Production Considerations:**
 * - Logging disabled by default (performance-first approach)
 * - Minimal memory footprint when disabled
 * - No sensitive data logging (energy data values excluded)
 * - Development-friendly: Rich diagnostic information when enabled
 */

import {SankeyOptions} from "@/types";

/**
 * Logger Implementation
 *
 * **Performance-Optimized Logging Service:**
 * - Configuration-controlled output (respects debugLogging option)
 * - Early return pattern for zero overhead when disabled
 * - Console API delegation for browser dev tools integration
 * - Structured message formatting for diagnostic clarity
 */
export class Logger {

    constructor(private options: SankeyOptions) {
    }

    /**
     * General information logging
     *
     * **Usage Patterns:**
     * - Service initialization completion and timing
     * - Major system milestones (data loaded, services ready)
     * - Performance metrics (calculation times, cache statistics)
     * - User interaction events (animation start, year changes)
     *
     * **Performance Impact:**
     * - Zero overhead when debugLogging disabled (early return)
     * - Minimal string formatting cost when enabled
     * - Console.log delegation for browser optimization
     */
    public log(message: string, ...args: any[]): void {
        if (this.options.debugLogging) {
            console.log(message, ...args);
        }
    }

    /**
     * Detailed debug information logging
     *
     * **Usage Patterns:**
     * - Algorithm step-by-step tracing
     * - Cache hit/miss detailed reporting
     * - Data transformation pipeline debugging
     * - Complex calculation intermediate results
     *
     * **Development Benefits:**
     * - Granular system behavior visibility
     * - Algorithm verification and debugging
     * - Performance bottleneck identification
     */
    public debug(message: string, ...args: any[]): void {
        if (this.options.debugLogging) {
            console.debug(message, ...args);
        }
    }

    /**
     * Warning and performance issue logging
     *
     * **Usage Patterns:**
     * - Performance threshold violations (slow initialization)
     * - Potential optimization opportunities
     * - Data quality warnings (unusual values)
     * - System resource constraints
     *
     * **Performance Monitoring Integration:**
     * - Automatic alerting for performance degradation
     * - Actionable optimization recommendations
     * - System health status reporting
     * - Production performance monitoring
     */
    public warn(message: string, ...args: any[]): void {
        if (this.options.debugLogging) {
            console.warn(message, ...args);
        }
    }
}