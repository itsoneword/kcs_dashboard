<script lang="ts">
    import { reportStore } from "$lib/stores/reports";
    import apiService from "$lib/api";
    import MultiSelectSearchable from "$lib/components/MultiSelectSearchable.svelte";
    import type { User, Engineer } from "$lib/types";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { setContext } from "svelte";
    import { writable } from "svelte/store";

    export let user: User;

    // Local buffered filter state
    let localEngineerIds: number[] = [];
    let localLeadIds: number[] = [];
    let localManagerIds: number[] = [];
    let localQuarters: string[] = [];
    let localYear: number = new Date().getFullYear();
    let localLinkRate: number = 35;

    // Options for selects
    let leadOptions: { value: number; label: string }[] = [];
    let managerOptions: { value: number; label: string }[] = [];
    let engineerOptions: { value: number; label: string }[] = [];

    // Ensure only one dropdown opens at a time
    const openDropdown = writable<string | null>(null);
    setContext("dropdownGroup", { openDropdown });

    // Reactive mapping of store.engineers into options
    $: engineerOptions = $reportStore.engineers.map((e: Engineer) => ({
        value: e.id,
        label: e.name,
    }));

    // Quarter multi-select options
    const quarterOptions = [
        { value: "Q1", label: "Q1 (Jan-Mar)" },
        { value: "Q2", label: "Q2 (Apr-Jun)" },
        { value: "Q3", label: "Q3 (Jul-Sep)" },
        { value: "Q4", label: "Q4 (Oct-Dec)" },
    ];

    onMount(async () => {
        // Initialize buffered values from store
        const state = get(reportStore);
        localEngineerIds = [...state.selectedEngineerIds];
        localQuarters = state.filters.quarter ? [state.filters.quarter] : [];
        localYear = state.filters.year ?? new Date().getFullYear();
        localLinkRate = state.linkRateExpectation;

        // Load all users to derive leads and managers
        try {
            const res = await apiService.getAllUsers();
            leadOptions = res.users
                .filter((u) => u.is_lead)
                .map((u) => ({ value: u.id, label: u.name }));
            managerOptions = res.users
                .filter((u) => u.is_manager)
                .map((u) => ({ value: u.id, label: u.name }));
        } catch (e) {
            console.error("Failed to load users for lead/manager filters", e);
        }
    });

    // Clear local filters back to defaults
    function clearFilters() {
        localEngineerIds = [];
        localLeadIds = [];
        localManagerIds = [];
        localQuarters = [];
        localYear = new Date().getFullYear();
        localLinkRate = 35;
    }

    async function applyFilters() {
        // Build final engineer ID list
        const state = get(reportStore);
        const allEngineers = state.engineers;
        let finalIds = [...localEngineerIds];

        // Include engineers for selected leads
        localLeadIds.forEach((leadId) => {
            allEngineers
                .filter((e) => e.lead_user_id === leadId)
                .map((e) => e.id)
                .forEach((id) => {
                    if (!finalIds.includes(id)) finalIds.push(id);
                });
        });

        // Include engineers for selected managers via assignment API
        for (const managerId of localManagerIds) {
            try {
                const res = await apiService.getUsersForManager(managerId);
                const assignedUserIds = res.users.map((u) => u.id);
                allEngineers
                    .filter((e) => assignedUserIds.includes(e.lead_user_id!))
                    .map((e) => e.id)
                    .forEach((id) => {
                        if (!finalIds.includes(id)) finalIds.push(id);
                    });
            } catch (e) {
                console.error(
                    `Failed to load users for manager ${managerId}`,
                    e,
                );
            }
        }

        // Push buffered filters into store
        reportStore.updateSelectedEngineers(finalIds);
        // Only send a single quarter filter; if exactly one selected, send it, else show all
        const quarterParam =
            localQuarters.length === 1 ? localQuarters[0] : undefined;
        reportStore.updateFilters({
            quarter: quarterParam,
            quarters: localQuarters,
            year: localYear,
            lead_user_ids: localLeadIds,
            manager_user_ids: localManagerIds,
        });
        reportStore.updateLinkRateExpectation(localLinkRate);

        // Generate report with new filters
        await reportStore.generateReport();
    }
</script>

<div class="card p-6 mb-8">
    <h2 class="text-xl font-semibold text-gray-900 mb-6">Report Parameters</h2>

    <div class="grid grid-cols-1 md:grid-cols-6 gap-6">
        <!-- Engineers Filter -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Engineers</label
            >
            <MultiSelectSearchable
                group="engineers"
                options={engineerOptions}
                bind:values={localEngineerIds}
                placeholder="All Engineers"
                searchPlaceholder="Search engineers..."
            />
        </div>

        <!-- Lead Filter -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Leads</label
            >
            <MultiSelectSearchable
                group="leads"
                options={leadOptions}
                bind:values={localLeadIds}
                placeholder="All Leads"
                searchPlaceholder="Search leads..."
            />
        </div>

        <!-- Manager Filter -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Managers</label
            >
            <MultiSelectSearchable
                group="managers"
                options={managerOptions}
                bind:values={localManagerIds}
                placeholder="All Managers"
                searchPlaceholder="Search managers..."
            />
        </div>

        <!-- Quarter Filter -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Quarters</label
            >
            <MultiSelectSearchable
                group="quarters"
                options={quarterOptions}
                bind:values={localQuarters}
                placeholder="All Quarters"
                searchPlaceholder="Search quarters..."
            />
        </div>

        <!-- Year Filter -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Year</label
            >
            <select
                value={localYear}
                on:change={(event) => {
                    const target = event.target as HTMLSelectElement;
                    localYear = parseInt(target.value);
                }}
                class="input"
            >
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
            </select>
        </div>

        <!-- Link Rate Expectations -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
                >Link Rate Expectation %</label
            >
            <input
                type="number"
                value={localLinkRate}
                on:input={(event) => {
                    const target = event.target as HTMLInputElement;
                    localLinkRate = parseInt(target.value) || 35;
                }}
                min="0"
                max="100"
                class="input"
                placeholder="35"
            />
        </div>
    </div>

    <!-- Apply & Clear Buttons -->
    <div class="mt-6 flex flex-wrap gap-2">
        <button on:click={applyFilters} class="btn-primary w-full md:w-auto">
            {#if $reportStore.isLoading}
                <svg
                    class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                Applying & Generating...
            {:else}
                Apply Filters
            {/if}
        </button>
        <button on:click={clearFilters} class="btn-secondary w-full md:w-auto">
            Clear Filters
        </button>
    </div>
</div>
