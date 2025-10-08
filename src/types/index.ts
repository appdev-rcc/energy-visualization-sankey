/**
 * Type Definitions for Energy Sankey Library
 *
 * Comprehensive TypeScript type definitions for energy visualization data structures,
 * configuration options, service interfaces, and mathematical computation types.
 *
 * Key Type Categories:
 * - Error types: Custom error classes with detailed context
 * - Data structures: Energy data points, summaries, and flow calculations
 * - Configuration: Visual constants, fuel definitions, and styling
 * - Mathematical types: Graph data, positioning, and computational results
 * - Service interfaces: D3 selections, render data, and layout structures
 *
 * Type Safety Features:
 * - Immutable readonly properties for data integrity
 * - Strict type constraints for fuel and sector names
 * - Comprehensive interface coverage for all service operations
 * - Generic types for flexible service composition
 *
 */

// Error types
export class SankeyError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'SankeyError';
    }
}

export class DataValidationError extends SankeyError {
    constructor(message: string, public field?: string) {
        super(message, 'DATA_VALIDATION');
        this.name = 'DataValidationError';
    }
}

// Energy sector breakdown interface
export interface EnergySectorBreakdown {
    readonly elec: number;
    readonly res: number;
    readonly ag: number;
    readonly indus: number;
    readonly trans: number;
    readonly heat: number;

    [key: string]: number; // Allow dynamic access
}

// Core data structures
export interface EnergyDataPoint {
    readonly year: number;
    readonly milestone?: string;
    readonly elec: EnergySectorBreakdown;
    readonly waste: EnergySectorBreakdown;
    readonly solar: EnergySectorBreakdown;
    readonly nuclear: EnergySectorBreakdown;
    readonly hydro: EnergySectorBreakdown;
    readonly wind: EnergySectorBreakdown;
    readonly geo: EnergySectorBreakdown;
    readonly gas: EnergySectorBreakdown;
    readonly coal: EnergySectorBreakdown;
    readonly bio: EnergySectorBreakdown;
    readonly petro: EnergySectorBreakdown;
    readonly heat: EnergySectorBreakdown;
}

// Options interface
export interface SankeyOptions {
    readonly data: EnergyDataPoint[];
    readonly country: string;
    readonly includeControls?: boolean;
    readonly includeTimeline?: boolean;
    readonly includeWasteToggle?: boolean;
    readonly autoPlay?: boolean;
    readonly showWasteHeat?: boolean;
    readonly animationSpeed?: number;
    readonly width?: number | null;
    readonly height?: number;
    readonly loopAnimation?: boolean;
    readonly debugLogging?: boolean;
}

export interface RequiredSankeyOptions extends Required<SankeyOptions> {
    // All optional properties are now required with defaults
}

// Mathematical structures
export interface GraphPoint {
    x: number;
    y: number;
}

export interface GraphStroke {
    fuel: string;
    box: string;
    value: number;
    stroke: number;
    a: GraphPoint;
    b: GraphPoint;
    c: GraphPoint;
    d: GraphPoint;
    cc: GraphPoint;
}

export interface GraphData {
    year: number;
    graph: GraphStroke[];
    totals: { [key: string]: number };
    offsets: Offest;
}

interface OffestX {
    solar: number,
    nuclear: number,
    hydro: number,
    wind: number,
    geo: number,
    gas: number,
    coal: number,
    bio: number,
    petro: number
}

interface OffestY {
    elec: number,
    res: number,                                    // Electricity and residential
    ag: number,
    indus: number,
    trans: number,
    heat?: number | undefined,
}

export interface Offest {
    x: OffestX;
    y: OffestY;
}

// Summary data structures
export interface YearTotals {
    year: number;
    elec: number;
    res: number;
    ag: number;
    indus: number;
    trans: number;
    solar: number;
    nuclear: number;
    hydro: number;
    wind: number;
    geo: number;
    gas: number;
    coal: number;
    bio: number;
    petro: number;
    fuel_height: number;
    waste: number;
    heat?: number | undefined;
    milestone?: any;

    [key: string]: any;
}

export interface YearFlows {
    year: number;
    elec: number;
    res: number;
    ag: number;
    indus: number;
    trans: number;
    heat?: number | undefined;
}

export interface YearLabels {
    year: number;
    elec: number;
    res: number;
    ag: number;
    indus: number;
    trans: number;
    solar: number;
    nuclear: number;
    hydro: number;
    wind: number;
    geo: number;
    gas: number;
    coal: number;
    bio: number;
    petro: number;
    heat?: number | undefined;
}

export interface BoxMaxes {
    [boxName: string]: number;
}

export interface BoxTops {
    [key: string]: number;

    res: number;
    ag: number;
    indus: number;
    trans: number;
}

export interface YearSums {
    [year: number]: number;
}

export interface SummaryData {
    totals: YearTotals[];
    flows: YearFlows[];
    labels: YearLabels[];
    maxes: BoxMaxes;
    boxTops: BoxTops;
    yearSums: YearSums;
}

// D3 Selection types
export type D3SVGSelection = d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
export type D3DivSelection = d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;