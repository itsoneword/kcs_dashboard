<script lang="ts">
    import { reportStore } from "$lib/stores/reports";
    import type { Engineer, EvaluationStats } from "$lib/types";
    import RadarChart from './RadarChart.svelte';

    export let engineer: Engineer;

    // Helper function to format percentage
    function formatPercentage(value: number | undefined): string {
        if (value === undefined || isNaN(value)) return "0%";
        return `${Math.round(value)}%`;
    }

    // Helper function to get color class based on link rate
    function getLinkRateColorClass(
        linkRate: number | undefined,
        expectation: number,
    ): string {
        if (linkRate === undefined || isNaN(linkRate)) return "text-gray-500";
        return linkRate >= expectation ? "text-green-600" : "text-red-600";
    }

    // Helper function to get trend indicator
    function getTrendIndicator(
        current: number | undefined,
        previous: number | undefined,
    ): { trend: "up" | "down" | "neutral"; color: string } {
        if (current === undefined || previous === undefined)
            return { trend: "neutral", color: "text-gray-500" };
        if (current > previous) return { trend: "up", color: "text-green-600" };
        if (current < previous) return { trend: "down", color: "text-red-600" };
        return { trend: "neutral", color: "text-yellow-600" };
    }

    // Get engineer stats
    $: stats = $reportStore.individualStats[engineer.id];
    // Monthly data
    $: monthlyData = $reportStore.monthlyData[engineer.id] || [];

    // Filter by selected quarters: use client-side mapping quarter->months
    function getQuarterMonths(quarter: string): number[] {
        switch (quarter) {
            case "Q1":
                return [1, 2, 3];
            case "Q2":
                return [4, 5, 6];
            case "Q3":
                return [7, 8, 9];
            case "Q4":
                return [10, 11, 12];
            default:
                return [];
        }
    }

    // which quarters were selected
    $: selectedQuarters = $reportStore.filters.quarters || [];

    // derive allowed months
    $: allowedMonths =
        selectedQuarters.length > 0
            ? Array.from(
                  new Set(selectedQuarters.flatMap((q) => getQuarterMonths(q))),
              )
            : monthlyData.map((d) => d.month_number);

    // final filtered monthly data
    $: filteredMonthlyData = monthlyData.filter((d) =>
        allowedMonths.includes(d.month_number),
    );

    // New helper: Contribution Rate
    function getContributionRate(stats: EvaluationStats): number {
        const num =
            stats.relevant_link_count +
            stats.article_created_count +
            stats.article_improved_count;
        const den =
            stats.kb_potential_count +
            stats.improvement_opportunity_count +
            stats.create_opportunity_count;
        return den > 0 ? num / den : 0;
    }

    // New helper: Accuracy Rate
    function getAccuracyRate(stats: EvaluationStats): number {
        return stats.article_linked_count > 0
            ? stats.relevant_link_count / stats.article_linked_count
            : 0;
    }

    // New helper: Link Rate
    function getLinkRate(stats: EvaluationStats): number {
        return stats.kb_potential_count > 0
            ? (stats.article_linked_count / stats.kb_potential_count) * 100
            : 0;
    }

    // Use overall stats for team comparison
    $: teamStats = $reportStore.overallStats;
</script>

<div class="card p-6 mb-8">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">{engineer.name}</h2>
        <a
            href="/evaluations?engineer_id={engineer.id}"
            class="text-blue-600 hover:text-blue-800 text-sm"
        >
            View Evaluations →
        </a>
    </div>
    <div class="mb-4 text-sm text-gray-700">
        <span class="mr-6"
            ><strong>Lead:</strong> {engineer.lead_name || "None"}</span
        >
        <span><strong>Coach:</strong> {engineer.coach_name || "None"}</span>
    </div>

    {#if stats}
        <div class="mb-6">
            <RadarChart
                labels={[ 'Link Rate', 'Contribution Rate', 'Accuracy Rate', 'Metric 4', 'Metric 5', 'Metric 6' ]}
                teamData={[ getLinkRate(teamStats!), getContributionRate(teamStats!) * 100, getAccuracyRate(teamStats!) * 100, 0, 0, 0 ]}
                personalData={[ getLinkRate(stats), getContributionRate(stats) * 100, getAccuracyRate(stats) * 100, 0, 0, 0 ]}
                width={500}
                height={500}
            />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Link Rate -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-medium text-gray-500">
                    Link Rate
                    <span
                        title="Articles Linked / KB Potential"
                        class="ml-1 text-gray-400 cursor-help">ℹ</span
                    >
                </h3>
                <p class="mt-2 flex items-center">
                    <span
                        class="text-3xl font-semibold {getLinkRateColorClass(
                            getLinkRate(stats),
                            $reportStore.linkRateExpectation,
                        )}"
                    >
                        {formatPercentage(getLinkRate(stats))}
                    </span>
                    <span class="ml-2 text-sm text-gray-500"
                        >vs {formatPercentage($reportStore.linkRateExpectation)}
                        target</span
                    >
                </p>
            </div>

            <!-- Contribution Rate -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-medium text-gray-500">
                    Contribution Rate
                    <span
                        title="(Relevant Links + Articles Created + Articles Improved) / (KB Potential + Improvement Opportunity + Create Opportunity)"
                        class="ml-1 text-gray-400 cursor-help">ℹ</span
                    >
                </h3>
                <p class="mt-2">
                    <span class="text-3xl font-semibold text-gray-900">
                        {formatPercentage(getContributionRate(stats) * 100)}
                    </span>
                </p>
            </div>

            <!-- Accuracy Rate -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-medium text-gray-500">
                    Accuracy Rate
                    <span
                        title="Relevant Links / Articles Linked"
                        class="ml-1 text-gray-400 cursor-help">ℹ</span
                    >
                </h3>
                <p class="mt-2">
                    <span class="text-3xl font-semibold text-gray-900">
                        {formatPercentage(getAccuracyRate(stats) * 100)}
                    </span>
                </p>
            </div>
        </div>

        <!-- KCS Detailed Stats -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- KCS Stats -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-medium text-gray-500 mb-4">
                    KCS Performance
                </h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Cases Evaluated</span>
                        <span>{stats.evaluated_cases}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>KB Potential</span>
                        <span>{stats.kb_potential_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Linked Articles</span>
                        <span>{stats.article_linked_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Relevant Links</span>
                        <span>{stats.relevant_link_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Articles May Be Improved / Improved</span>
                        <span
                            >{stats.improvement_opportunity_count}/{stats.article_improved_count}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span>Articles May Be Created / Created</span>
                        <span
                            >{stats.create_opportunity_count}/{stats.article_created_count}</span
                        >
                    </div>
                </div>
            </div>

            <!-- Monthly Trend Table -->
            {#if filteredMonthlyData.length > 0}
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 class="text-sm font-medium text-gray-500 mb-4">
                        Monthly Trend
                    </h3>
                    <table class="w-full text-left">
                        <thead>
                            <tr>
                                <th
                                    class="px-2 py-1 text-sm font-medium text-gray-600"
                                    >Month</th
                                >
                                <th
                                    class="px-2 py-1 text-sm font-medium text-gray-600"
                                    >Link Rate</th
                                >
                                <th
                                    class="px-2 py-1 text-sm font-medium text-gray-600"
                                    >Contribution</th
                                >
                                <th
                                    class="px-2 py-1 text-sm font-medium text-gray-600"
                                    >Accuracy</th
                                >
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredMonthlyData as data}
                                <tr>
                                    <td class="px-2 py-1 text-sm text-gray-700"
                                        >{data.month}</td
                                    >
                                    <td
                                        class="px-2 py-1 text-sm {getLinkRateColorClass(
                                            getLinkRate(data.stats),
                                            $reportStore.linkRateExpectation,
                                        )}"
                                        >{formatPercentage(
                                            getLinkRate(data.stats),
                                        )}</td
                                    >
                                    <td class="px-2 py-1 text-sm text-gray-700"
                                        >{formatPercentage(
                                            getContributionRate(data.stats) *
                                                100,
                                        )}</td
                                    >
                                    <td class="px-2 py-1 text-sm text-gray-700"
                                        >{formatPercentage(
                                            getAccuracyRate(data.stats) * 100,
                                        )}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    {:else}
        <div class="text-center py-8 text-gray-500">
            No statistics available for this engineer.
        </div>
    {/if}
</div>

<style>
    .stat-card {
        @apply bg-white p-4 rounded-lg border border-gray-200;
    }
</style>
