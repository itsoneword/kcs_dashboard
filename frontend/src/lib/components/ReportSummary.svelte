<script lang="ts">
    import { reportStore, selectedEngineers } from "$lib/stores/reports";
    import type { EvaluationStats } from "$lib/types";

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
        return { trend: "neutral", color: "text-gray-500" };
    }

    // Helper function to get quarter name
    function getQuarterName(quarter: string): string {
        const quarterMap: Record<string, string> = {
            Q1: "Jan-Mar",
            Q2: "Apr-Jun",
            Q3: "Jul-Sep",
            Q4: "Oct-Dec",
        };
        return quarterMap[quarter] || quarter;
    }

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

    $: stats = $reportStore.overallStats;
    $: quarterlyStats = $reportStore.quarterlyStats;
    $: linkRateExpectation = $reportStore.linkRateExpectation;
    $: leadNames = Array.from(
        new Set($selectedEngineers.map((e) => e.lead_name).filter(Boolean)),
    );
    $: engineerNames = $selectedEngineers.map((e) => e.name);
    // Determine which quarters to display: use selected filter or all
    $: selectedQuarters =
        $reportStore.filters.quarters &&
        $reportStore.filters.quarters.length > 0
            ? $reportStore.filters.quarters
            : quarterlyStats
              ? Object.keys(quarterlyStats)
              : [];
</script>

<div class="card p-6 mb-8">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Overall Statistics</h2>
    {#if leadNames.length}
        <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p class="text-sm text-blue-700">
                Summary for these leads: {leadNames.join(", ")}
            </p>
            <p class="mt-1 text-sm text-gray-600">
                Engineers: {engineerNames.join(", ")}
            </p>
        </div>
    {/if}
    {#if $reportStore.overallStats}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Link Rate -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-medium text-gray-500">
                    Link Rate
                    <abbr
                        title="Articles Linked / KB Potential"
                        class="ml-1 text-gray-400">ℹ</abbr
                    >
                </h3>
                <p class="mt-2 flex items-center">
                    <span
                        class="text-3xl font-semibold {getLinkRateColorClass(
                            getLinkRate(stats!),
                            linkRateExpectation,
                        )}"
                    >
                        {formatPercentage(getLinkRate(stats!))}
                    </span>
                    <span class="ml-2 text-sm text-gray-500"
                        >vs {formatPercentage(linkRateExpectation)} target</span
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
                    <span class="text-3xl font-semibold text-gray-900"
                        >{formatPercentage(
                            getContributionRate(stats!) * 100,
                        )}</span
                    >
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
                    <span class="text-3xl font-semibold text-gray-900"
                        >{formatPercentage(getAccuracyRate(stats!) * 100)}</span
                    >
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
                        <span>{stats!.evaluated_cases}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>KB Potential</span>
                        <span>{stats!.kb_potential_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Linked Articles</span>
                        <span>{stats!.article_linked_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Relevant Links</span>
                        <span>{stats!.relevant_link_count}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Articles May Be Improved / Improved</span>
                        <span
                            >{stats!.improvement_opportunity_count}/{stats!
                                .article_improved_count}</span
                        >
                    </div>
                    <div class="flex justify-between">
                        <span>Articles May Be Created / Created</span>
                        <span
                            >{stats!.create_opportunity_count}/{stats!
                                .article_created_count}</span
                        >
                    </div>
                </div>
            </div>

            <!-- Quarterly Comparison -->
            {#if quarterlyStats}
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 class="text-sm font-medium text-gray-500 mb-4">
                        Quarterly Comparison
                    </h3>
                    <table class="w-full text-left">
                        <thead>
                            <tr>
                                <th
                                    class="px-2 py-1 text-sm font-medium text-gray-600"
                                    >Quarter</th
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
                            {#each selectedQuarters as quarter}
                                {#if quarterlyStats[quarter]}
                                    <tr>
                                        <td
                                            class="px-2 py-1 text-sm text-gray-700"
                                            >{getQuarterName(quarter)}</td
                                        >
                                        <td
                                            class="px-2 py-1 text-sm {getLinkRateColorClass(
                                                getLinkRate(
                                                    quarterlyStats[quarter],
                                                ),
                                                linkRateExpectation,
                                            )}"
                                            >{formatPercentage(
                                                getLinkRate(
                                                    quarterlyStats[quarter],
                                                ),
                                            )}</td
                                        >
                                        <td
                                            class="px-2 py-1 text-sm text-gray-700"
                                            >{formatPercentage(
                                                getContributionRate(
                                                    quarterlyStats[quarter],
                                                ) * 100,
                                            )}</td
                                        >
                                        <td
                                            class="px-2 py-1 text-sm text-gray-700"
                                            >{formatPercentage(
                                                getAccuracyRate(
                                                    quarterlyStats[quarter],
                                                ) * 100,
                                            )}</td
                                        >
                                    </tr>
                                {/if}
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    {:else}
        <div class="text-center py-8 text-gray-500">
            No report data available. Click "Generate Report" to view
            statistics.
        </div>
    {/if}
</div>

<style>
    .stat-card {
        @apply bg-white p-4 rounded-lg border border-gray-200;
    }
</style>
