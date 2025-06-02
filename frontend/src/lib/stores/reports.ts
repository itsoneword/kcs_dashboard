import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto, pushState, replaceState } from '$app/navigation';
import apiService from '$lib/api';
import type { EvaluationStats, ReportFilters, Engineer } from '../types';

export interface MonthlyData {
    month: string;
    month_number: number;
    stats: EvaluationStats;
}

export interface ReportState {
    // Basic data
    engineers: Engineer[];
    selectedEngineerIds: number[];

    // Filters
    filters: ReportFilters;
    linkRateExpectation: number;

    // Report data
    overallStats: EvaluationStats | null;
    quarterlyStats: Record<string, EvaluationStats> | null;
    individualStats: Record<number, EvaluationStats>;
    monthlyData: Record<number, MonthlyData[]>;

    // Quick filter engineers
    myTeamEngineers: Engineer[];
    myWorkersEngineers: Engineer[];

    // UI state
    isLoading: boolean;
    reportGenerated: boolean;
    error: string | null;

    // Navigation state for restoration
    lastReportUrl: string | null;
    lastScrollPosition: number;
}

const initialState: ReportState = {
    engineers: [],
    selectedEngineerIds: [],

    filters: {
        year: new Date().getFullYear()
    },
    linkRateExpectation: 35,

    overallStats: null,
    quarterlyStats: null,
    individualStats: {},
    monthlyData: {},

    myTeamEngineers: [],
    myWorkersEngineers: [],

    isLoading: false,
    reportGenerated: false,
    error: null,

    lastReportUrl: null,
    lastScrollPosition: 0
};

function createReportStore() {
    const { subscribe, set, update } = writable<ReportState>(initialState);

    return {
        subscribe,

        // Initialize store - now only restores from localStorage if needed
        init: () => {
            update(state => {
                const newState = { ...state };

                // Restore from localStorage if available
                if (browser) {
                    const savedState = localStorage.getItem('reportState');
                    if (savedState) {
                        try {
                            const parsed = JSON.parse(savedState);
                            // Only restore certain fields
                            newState.lastReportUrl = parsed.lastReportUrl;
                            newState.lastScrollPosition = parsed.lastScrollPosition;
                        } catch (e) {
                            console.warn('Failed to parse saved report state');
                        }
                    }
                }

                return newState;
            });
        },

        // Save state to localStorage for navigation restoration
        saveState: () => {
            update(state => {
                if (browser) {
                    const stateToSave = {
                        lastReportUrl: state.lastReportUrl,
                        lastScrollPosition: state.lastScrollPosition,
                        filters: state.filters,
                        selectedEngineerIds: state.selectedEngineerIds,
                        linkRateExpectation: state.linkRateExpectation
                    };
                    localStorage.setItem('reportState', JSON.stringify(stateToSave));
                }
                return state;
            });
        },

        // Set loading state
        setLoading: (loading: boolean) => {
            update(state => ({ ...state, isLoading: loading }));
        },

        // Set error state
        setError: (error: string | null) => {
            update(state => ({ ...state, error }));
        },

        // Load engineers data
        loadEngineers: async () => {
            try {
                const response = await apiService.getEngineersForReports();
                update(state => ({ ...state, engineers: response.engineers }));
            } catch (error) {
                console.error('Error loading engineers:', error);
                update(state => ({ ...state, error: 'Failed to load engineers' }));
            }
        },

        // Load quick filter engineers
        loadQuickFilterEngineers: async (userId: number, isLead: boolean, isCoach: boolean, isManager: boolean = false) => {
            try {
                const promises = [];

                if (isLead || isManager) {
                    promises.push(apiService.getEngineersByLead(userId));
                }
                if (isCoach) {
                    promises.push(apiService.getEngineersByCoach(userId));
                }

                const results = await Promise.all(promises);

                update(state => ({
                    ...state,
                    myTeamEngineers: (isLead || isManager) && results[0] ? results[0].engineers : [],
                    myWorkersEngineers: isCoach ? (results[(isLead || isManager) ? 1 : 0] || { engineers: [] }).engineers : []
                }));
            } catch (error) {
                console.error('Error loading quick filter engineers:', error);
            }
        },

        // Update filters
        updateFilters: (newFilters: Partial<ReportFilters>) => {
            update(state => ({
                ...state,
                filters: { ...state.filters, ...newFilters }
            }));
        },

        // Update selected engineers
        updateSelectedEngineers: (engineerIds: number[]) => {
            update(state => ({
                ...state,
                selectedEngineerIds: engineerIds
            }));
        },

        // Update link rate expectation
        updateLinkRateExpectation: (expectation: number) => {
            update(state => ({
                ...state,
                linkRateExpectation: expectation
            }));
        },

        // Generate report using batch API
        generateReport: async () => {
            update(state => ({ ...state, isLoading: true, error: null }));

            try {
                let currentState: ReportState;
                const unsubscribe = subscribe(state => currentState = state);
                unsubscribe();

                const { filters, selectedEngineerIds } = currentState!;

                if (selectedEngineerIds.length === 0) {
                    throw new Error('Please select at least one engineer');
                }

                // Get batch stats
                const response = await apiService.getBatchStats({
                    ...filters,
                    engineer_ids: selectedEngineerIds
                });

                update(state => ({
                    ...state,
                    overallStats: response.overall_stats,
                    quarterlyStats: response.quarterly_stats,
                    individualStats: response.individual_stats,
                    monthlyData: response.monthly_data,
                    reportGenerated: true,
                    isLoading: false
                }));

                // Update URL only after successful report generation
                if (browser) {
                    const url = new URL(window.location.href);
                    url.search = ''; // Clear existing params

                    // Add parameters in compact format
                    // Use compact format for engineer IDs: engineer_id(21,22,...)
                    if (selectedEngineerIds.length > 0) {
                        const engineerParam = `engineer_id(${selectedEngineerIds.join(',')})`;
                        url.searchParams.set('filter', engineerParam);
                    }
                    
                    if (filters.year) {
                        url.searchParams.set('year', filters.year.toString());
                    }
                    if (filters.quarter) {
                        url.searchParams.set('quarter', filters.quarter);
                    }

                    await pushState(url.toString(), { reportGenerated: true });
                }

            } catch (error: any) {
                console.error('Error generating report:', error);
                update(state => ({
                    ...state,
                    error: error.message || 'Failed to generate report',
                    isLoading: false
                }));
            }
        },

        // Reset store to initial state
        reset: () => {
            set(initialState);
        },

        // Parse URL parameters and update store state
        parseUrlParams: (url: URL) => {
            const filters: Partial<ReportFilters> = {};
            let engineerIds: number[] = [];
            
            // Parse year parameter
            const year = url.searchParams.get('year');
            if (year && !isNaN(parseInt(year))) {
                filters.year = parseInt(year);
            }
            
            // Parse quarter parameter
            const quarter = url.searchParams.get('quarter');
            if (quarter) {
                filters.quarter = quarter;
            }
            
            // Parse engineer IDs - support both formats:
            // 1. Legacy format: engineer_ids=21,22,23
            // 2. New compact format: filter=engineer_id(21,22,23)
            const legacyEngineerIds = url.searchParams.get('engineer_ids');
            const compactFilter = url.searchParams.get('filter');
            
            if (legacyEngineerIds) {
                engineerIds = legacyEngineerIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            } else if (compactFilter) {
                // Parse engineer_id(21,22,23) format
                const match = compactFilter.match(/engineer_id\((\d+(?:,\d+)*)\)/);
                if (match && match[1]) {
                    engineerIds = match[1].split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
                }
            }
            
            // Update store with parsed values
            if (Object.keys(filters).length > 0) {
                reportStore.updateFilters(filters);
            }
            
            if (engineerIds.length > 0) {
                reportStore.updateSelectedEngineers(engineerIds);
            }
            
            return { filters, engineerIds };
        }
    };
}

// Helper function to get months for a quarter
function getQuarterMonths(quarter: string): number[] {
    switch (quarter) {
        case 'Q1': return [1, 2, 3];
        case 'Q2': return [4, 5, 6];
        case 'Q3': return [7, 8, 9];
        case 'Q4': return [10, 11, 12];
        default: return [];
    }
}

export const reportStore = createReportStore();

// Derived stores for computed values
export const selectedEngineers = derived(
    reportStore,
    ($reportStore) => $reportStore.selectedEngineerIds.length === 0
        ? $reportStore.engineers
        : $reportStore.engineers.filter(e => $reportStore.selectedEngineerIds.includes(e.id))
);

export const selectedEngineersDisplay = derived(
    reportStore,
    ($reportStore) => {
        if ($reportStore.selectedEngineerIds.length === 0) return 'All Engineers';
        if ($reportStore.selectedEngineerIds.length === 1) {
            const engineer = $reportStore.engineers.find(e => e.id === $reportStore.selectedEngineerIds[0]);
            return engineer ? engineer.name : 'Unknown Engineer';
        }
        return `${$reportStore.selectedEngineerIds.length} Engineers Selected`;
    }
);

export const reportCacheKey = derived(
    reportStore,
    ($reportStore) => {
        const sortedIds = [...$reportStore.selectedEngineerIds].sort();
        const year = $reportStore.filters.year || new Date().getFullYear();
        const quarter = $reportStore.filters.quarter || 'all';
        return `report_${sortedIds.join('_')}_${year}_${quarter}`;
    }
); 