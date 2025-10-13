/**
 * Energy Sankey
 *
 * Modern TypeScript energy visualization library with event-driven architecture.
 * Provides interactive Sankey diagrams for energy consumption.
 *
 * Key Features:
 * - Event-driven service communication with type safety
 * - High-performance caching (4-layer optimization)
 * - Complete mathematical accuracy preservation
 * - Responsive design with mobile optimization
 * - Comprehensive accessibility support
 *
 * @author Research Computing Center (RCC), University of Chicago
 */

// Export public type definitions for TypeScript consumers
export type {
    SankeyOptions,
    EnergyDataPoint,
    SummaryData,
    GraphData,
    YearTotals,
    BoxMaxes,
    BoxTops
} from '@/types/index';

// Export error handling types
export {
    SankeyError,
    DataValidationError
} from '@/types/index';

// Export the main visualization class
export {default as default} from '@/core/Sankey';