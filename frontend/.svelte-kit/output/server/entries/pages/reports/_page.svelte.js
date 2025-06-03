import { s as setContext, g as store_get, k as copy_payload, l as assign_payload, u as unsubscribe_stores, m as bind_props, a as pop, p as push, j as attr, o as attr_style, i as stringify, c as escape_html, b as attr_class, e as ensure_array_like } from "../../../chunks/index2.js";
import { d as derived, w as writable } from "../../../chunks/index.js";
import { B as BROWSER, y as fallback } from "../../../chunks/utils.js";
import { p as pushState } from "../../../chunks/client.js";
import { a as apiService } from "../../../chunks/api.js";
import { M as MultiSelectSearchable, H as Header } from "../../../chunks/Header.js";
import "chart.js/auto";
const browser = BROWSER;
const initialState = {
  engineers: [],
  selectedEngineerIds: [],
  filters: {
    year: (/* @__PURE__ */ new Date()).getFullYear()
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
  const { subscribe, set, update } = writable(initialState);
  return {
    subscribe,
    // Initialize store - now only restores from localStorage if needed
    init: () => {
      update((state) => {
        const newState = { ...state };
        return newState;
      });
    },
    // Save state to localStorage for navigation restoration
    saveState: () => {
      update((state) => {
        return state;
      });
    },
    // Set loading state
    setLoading: (loading) => {
      update((state) => ({ ...state, isLoading: loading }));
    },
    // Set error state
    setError: (error) => {
      update((state) => ({ ...state, error }));
    },
    // Load engineers data
    loadEngineers: async () => {
      try {
        const response = await apiService.getEngineersForReports();
        update((state) => ({ ...state, engineers: response.engineers }));
      } catch (error) {
        console.error("Error loading engineers:", error);
        update((state) => ({ ...state, error: "Failed to load engineers" }));
      }
    },
    // Load quick filter engineers
    loadQuickFilterEngineers: async (userId, isLead, isCoach, isManager = false) => {
      try {
        const promises = [];
        if (isLead || isManager) {
          promises.push(apiService.getEngineersByLead(userId));
        }
        if (isCoach) {
          promises.push(apiService.getEngineersByCoach(userId));
        }
        const results = await Promise.all(promises);
        update((state) => ({
          ...state,
          myTeamEngineers: (isLead || isManager) && results[0] ? results[0].engineers : [],
          myWorkersEngineers: isCoach ? (results[isLead || isManager ? 1 : 0] || { engineers: [] }).engineers : []
        }));
      } catch (error) {
        console.error("Error loading quick filter engineers:", error);
      }
    },
    // Update filters
    updateFilters: (newFilters) => {
      update((state) => ({
        ...state,
        filters: { ...state.filters, ...newFilters }
      }));
    },
    // Update selected engineers
    updateSelectedEngineers: (engineerIds) => {
      update((state) => ({
        ...state,
        selectedEngineerIds: engineerIds
      }));
    },
    // Update link rate expectation
    updateLinkRateExpectation: (expectation) => {
      update((state) => ({
        ...state,
        linkRateExpectation: expectation
      }));
    },
    // Generate report using batch API
    generateReport: async () => {
      update((state) => ({ ...state, isLoading: true, error: null }));
      try {
        let currentState;
        const unsubscribe = subscribe((state) => currentState = state);
        unsubscribe();
        const { filters, selectedEngineerIds } = currentState;
        if (selectedEngineerIds.length === 0) {
          throw new Error("Please select at least one engineer");
        }
        const response = await apiService.getBatchStats({
          ...filters,
          engineer_ids: selectedEngineerIds
        });
        update((state) => ({
          ...state,
          overallStats: response.overall_stats,
          quarterlyStats: response.quarterly_stats,
          individualStats: response.individual_stats,
          monthlyData: response.monthly_data,
          reportGenerated: true,
          isLoading: false
        }));
        if (browser) ;
      } catch (error) {
        console.error("Error generating report:", error);
        update((state) => ({
          ...state,
          error: error.message || "Failed to generate report",
          isLoading: false
        }));
      }
    },
    // Reset store to initial state
    reset: () => {
      set(initialState);
    },
    // Parse URL parameters and update store state
    parseUrlParams: (url) => {
      const filters = {};
      let engineerIds = [];
      const year = url.searchParams.get("year");
      if (year && !isNaN(parseInt(year))) {
        filters.year = parseInt(year);
      }
      const quarter = url.searchParams.get("quarter");
      if (quarter) {
        filters.quarter = quarter;
      }
      const legacyEngineerIds = url.searchParams.get("engineer_ids");
      const compactFilter = url.searchParams.get("filter");
      if (legacyEngineerIds) {
        engineerIds = legacyEngineerIds.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));
      } else if (compactFilter) {
        const match = compactFilter.match(/engineer_id\((\d+(?:,\d+)*)\)/);
        if (match && match[1]) {
          engineerIds = match[1].split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));
        }
      }
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
const reportStore = createReportStore();
const selectedEngineers = derived(
  reportStore,
  ($reportStore) => $reportStore.selectedEngineerIds.length === 0 ? $reportStore.engineers : $reportStore.engineers.filter((e) => $reportStore.selectedEngineerIds.includes(e.id))
);
derived(
  reportStore,
  ($reportStore) => {
    if ($reportStore.selectedEngineerIds.length === 0) return "All Engineers";
    if ($reportStore.selectedEngineerIds.length === 1) {
      const engineer = $reportStore.engineers.find((e) => e.id === $reportStore.selectedEngineerIds[0]);
      return engineer ? engineer.name : "Unknown Engineer";
    }
    return `${$reportStore.selectedEngineerIds.length} Engineers Selected`;
  }
);
derived(
  reportStore,
  ($reportStore) => {
    const sortedIds = [...$reportStore.selectedEngineerIds].sort();
    const year = $reportStore.filters.year || (/* @__PURE__ */ new Date()).getFullYear();
    const quarter = $reportStore.filters.quarter || "all";
    return `report_${sortedIds.join("_")}_${year}_${quarter}`;
  }
);
function ReportFilters($$payload, $$props) {
  push();
  var $$store_subs;
  let user = $$props["user"];
  let localEngineerIds = [];
  let localLeadIds = [];
  let localManagerIds = [];
  let localQuarters = [];
  (/* @__PURE__ */ new Date()).getFullYear();
  let localLinkRate = 35;
  let leadOptions = [];
  let managerOptions = [];
  let engineerOptions = [];
  const openDropdown = writable(null);
  setContext("dropdownGroup", { openDropdown });
  const quarterOptions = [
    { value: "Q1", label: "Q1 (Jan-Mar)" },
    { value: "Q2", label: "Q2 (Apr-Jun)" },
    { value: "Q3", label: "Q3 (Jul-Sep)" },
    { value: "Q4", label: "Q4 (Oct-Dec)" }
  ];
  engineerOptions = store_get($$store_subs ??= {}, "$reportStore", reportStore).engineers.map((e) => ({ value: e.id, label: e.name }));
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out += `<div class="card p-6 mb-8"><h2 class="text-xl font-semibold text-gray-900 mb-6">Report Parameters</h2> <div class="grid grid-cols-1 md:grid-cols-6 gap-6"><div><label class="block text-sm font-medium text-gray-700 mb-1">Engineers</label> `;
    MultiSelectSearchable($$payload2, {
      group: "engineers",
      options: engineerOptions,
      placeholder: "All Engineers",
      searchPlaceholder: "Search engineers...",
      get values() {
        return localEngineerIds;
      },
      set values($$value) {
        localEngineerIds = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Leads</label> `;
    MultiSelectSearchable($$payload2, {
      group: "leads",
      options: leadOptions,
      placeholder: "All Leads",
      searchPlaceholder: "Search leads...",
      get values() {
        return localLeadIds;
      },
      set values($$value) {
        localLeadIds = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Managers</label> `;
    MultiSelectSearchable($$payload2, {
      group: "managers",
      options: managerOptions,
      placeholder: "All Managers",
      searchPlaceholder: "Search managers...",
      get values() {
        return localManagerIds;
      },
      set values($$value) {
        localManagerIds = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Quarters</label> `;
    MultiSelectSearchable($$payload2, {
      group: "quarters",
      options: quarterOptions,
      placeholder: "All Quarters",
      searchPlaceholder: "Search quarters...",
      get values() {
        return localQuarters;
      },
      set values($$value) {
        localQuarters = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Year</label> <select class="input"><option${attr("value", 2025)}>2025</option><option${attr("value", 2024)}>2024</option><option${attr("value", 2023)}>2023</option></select></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Link Rate Expectation %</label> <input type="number"${attr("value", localLinkRate)} min="0" max="100" class="input" placeholder="35"/></div></div> <div class="mt-6 flex flex-wrap gap-2"><button class="btn-primary w-full md:w-auto">`;
    if (store_get($$store_subs ??= {}, "$reportStore", reportStore).isLoading) {
      $$payload2.out += "<!--[-->";
      $$payload2.out += `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Applying &amp; Generating...`;
    } else {
      $$payload2.out += "<!--[!-->";
      $$payload2.out += `Apply Filters`;
    }
    $$payload2.out += `<!--]--></button> <button class="btn-secondary w-full md:w-auto">Clear Filters</button></div></div>`;
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { user });
  pop();
}
function RadarChart($$payload, $$props) {
  push();
  let labels = fallback($$props["labels"], () => [], true);
  let teamData = fallback($$props["teamData"], () => [], true);
  let personalData = fallback($$props["personalData"], null);
  let width = fallback($$props["width"], 600);
  let height = fallback($$props["height"], 600);
  $$payload.out += `<canvas${attr_style(`width: ${stringify(width)}px; height: ${stringify(height)}px;`)}></canvas>`;
  bind_props($$props, {
    labels,
    teamData,
    personalData,
    width,
    height
  });
  pop();
}
function ReportSummary($$payload, $$props) {
  push();
  var $$store_subs;
  let stats, quarterlyStats, linkRateExpectation, leadNames, engineerNames, selectedQuarters;
  function formatPercentage(value) {
    if (value === void 0 || isNaN(value)) return "0%";
    return `${Math.round(value)}%`;
  }
  function getLinkRateColorClass(linkRate, expectation) {
    if (linkRate === void 0 || isNaN(linkRate)) return "text-gray-500";
    return linkRate >= expectation ? "text-green-600" : "text-red-600";
  }
  function getQuarterName(quarter) {
    const quarterMap = {
      Q1: "Jan-Mar",
      Q2: "Apr-Jun",
      Q3: "Jul-Sep",
      Q4: "Oct-Dec"
    };
    return quarterMap[quarter] || quarter;
  }
  function getContributionRate(stats2) {
    const num = stats2.relevant_link_count + stats2.article_created_count + stats2.article_improved_count;
    const den = stats2.kb_potential_count + stats2.improvement_opportunity_count + stats2.create_opportunity_count;
    return den > 0 ? num / den : 0;
  }
  function getAccuracyRate(stats2) {
    return stats2.article_linked_count > 0 ? stats2.relevant_link_count / stats2.article_linked_count : 0;
  }
  function getLinkRate(stats2) {
    return stats2.kb_potential_count > 0 ? stats2.article_linked_count / stats2.kb_potential_count * 100 : 0;
  }
  stats = store_get($$store_subs ??= {}, "$reportStore", reportStore).overallStats;
  quarterlyStats = store_get($$store_subs ??= {}, "$reportStore", reportStore).quarterlyStats;
  linkRateExpectation = store_get($$store_subs ??= {}, "$reportStore", reportStore).linkRateExpectation;
  leadNames = Array.from(new Set(store_get($$store_subs ??= {}, "$selectedEngineers", selectedEngineers).map((e) => e.lead_name).filter(Boolean)));
  engineerNames = store_get($$store_subs ??= {}, "$selectedEngineers", selectedEngineers).map((e) => e.name);
  selectedQuarters = store_get($$store_subs ??= {}, "$reportStore", reportStore).filters.quarters && store_get($$store_subs ??= {}, "$reportStore", reportStore).filters.quarters.length > 0 ? store_get($$store_subs ??= {}, "$reportStore", reportStore).filters.quarters : quarterlyStats ? Object.keys(quarterlyStats) : [];
  $$payload.out += `<div class="card p-6 mb-8"><h2 class="text-xl font-semibold text-gray-900 mb-4">Overall Statistics</h2> `;
  if (leadNames.length) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-start"><div class="p-4 bg-blue-50 border border-blue-200 rounded"><p class="text-sm text-blue-700">Summary for these leads: ${escape_html(leadNames.join(", "))}</p> <p class="mt-1 text-sm text-gray-600">Engineers: ${escape_html(engineerNames.join(", "))}</p></div> <div class="p-4 bg-white border border-gray-200 rounded">`;
    RadarChart($$payload, {
      labels: [
        "Link Rate",
        "Contribution Rate",
        "Accuracy Rate",
        "Metric 4",
        "Metric 5",
        "Metric 6"
      ],
      teamData: [
        formatPercentage(getLinkRate(stats))?.replace("%", ""),
        formatPercentage(getContributionRate(stats) * 100)?.replace("%", ""),
        formatPercentage(getAccuracyRate(stats) * 100)?.replace("%", ""),
        0,
        0,
        0
      ],
      personalData: [
        getLinkRate(stats),
        getContributionRate(stats) * 100,
        getAccuracyRate(stats) * 100,
        0,
        0,
        0
      ],
      width: 500,
      height: 500
    });
    $$payload.out += `<!----></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  if (store_get($$store_subs ??= {}, "$reportStore", reportStore).overallStats) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Link Rate <abbr title="Articles Linked / KB Potential" class="ml-1 text-gray-400">ℹ</abbr></h3> <p class="mt-2 flex items-center"><span${attr_class(`text-3xl font-semibold ${stringify(getLinkRateColorClass(getLinkRate(stats), linkRateExpectation))}`, "svelte-39fzlp")}>${escape_html(formatPercentage(getLinkRate(stats)))}</span> <span class="ml-2 text-sm text-gray-500">vs ${escape_html(formatPercentage(linkRateExpectation))} target</span></p></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Contribution Rate <span title="(Relevant Links + Articles Created + Articles Improved) / (KB Potential + Improvement Opportunity + Create Opportunity)" class="ml-1 text-gray-400 cursor-help">ℹ</span></h3> <p class="mt-2"><span class="text-3xl font-semibold text-gray-900">${escape_html(formatPercentage(getContributionRate(stats) * 100))}</span></p></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Accuracy Rate <span title="Relevant Links / Articles Linked" class="ml-1 text-gray-400 cursor-help">ℹ</span></h3> <p class="mt-2"><span class="text-3xl font-semibold text-gray-900">${escape_html(formatPercentage(getAccuracyRate(stats) * 100))}</span></p></div></div> <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"><div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500 mb-4">KCS Performance</h3> <div class="space-y-2"><div class="flex justify-between"><span>Cases Evaluated</span> <span>${escape_html(stats.evaluated_cases)}</span></div> <div class="flex justify-between"><span>KB Potential</span> <span>${escape_html(stats.kb_potential_count)}</span></div> <div class="flex justify-between"><span>Linked Articles</span> <span>${escape_html(stats.article_linked_count)}</span></div> <div class="flex justify-between"><span>Relevant Links</span> <span>${escape_html(stats.relevant_link_count)}</span></div> <div class="flex justify-between"><span>Articles May Be Improved / Improved</span> <span>${escape_html(stats.improvement_opportunity_count)}/${escape_html(stats.article_improved_count)}</span></div> <div class="flex justify-between"><span>Articles May Be Created / Created</span> <span>${escape_html(stats.create_opportunity_count)}/${escape_html(stats.article_created_count)}</span></div></div></div> `;
    if (quarterlyStats) {
      $$payload.out += "<!--[-->";
      const each_array = ensure_array_like(selectedQuarters);
      $$payload.out += `<div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500 mb-4">Quarterly Comparison</h3> <table class="w-full text-left"><thead><tr><th class="px-2 py-1 text-sm font-medium text-gray-600">Quarter</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Link Rate</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Contribution</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Accuracy</th></tr></thead><tbody><!--[-->`;
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let quarter = each_array[$$index];
        if (quarterlyStats[quarter]) {
          $$payload.out += "<!--[-->";
          $$payload.out += `<tr><td class="px-2 py-1 text-sm text-gray-700">${escape_html(getQuarterName(quarter))}</td><td${attr_class(`px-2 py-1 text-sm ${stringify(getLinkRateColorClass(getLinkRate(quarterlyStats[quarter]), linkRateExpectation))}`, "svelte-39fzlp")}>${escape_html(formatPercentage(getLinkRate(quarterlyStats[quarter])))}</td><td class="px-2 py-1 text-sm text-gray-700">${escape_html(formatPercentage(getContributionRate(quarterlyStats[quarter]) * 100))}</td><td class="px-2 py-1 text-sm text-gray-700">${escape_html(formatPercentage(getAccuracyRate(quarterlyStats[quarter]) * 100))}</td></tr>`;
        } else {
          $$payload.out += "<!--[!-->";
        }
        $$payload.out += `<!--]-->`;
      }
      $$payload.out += `<!--]--></tbody></table></div>`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<div class="text-center py-8 text-gray-500">No report data available. Click "Generate Report" to view
            statistics.</div>`;
  }
  $$payload.out += `<!--]--></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function EngineerStats($$payload, $$props) {
  push();
  var $$store_subs;
  let stats, monthlyData, selectedQuarters, allowedMonths, filteredMonthlyData, teamStats;
  let engineer = $$props["engineer"];
  function formatPercentage(value) {
    if (value === void 0 || isNaN(value)) return "0%";
    return `${Math.round(value)}%`;
  }
  function getLinkRateColorClass(linkRate, expectation) {
    if (linkRate === void 0 || isNaN(linkRate)) return "text-gray-500";
    return linkRate >= expectation ? "text-green-600" : "text-red-600";
  }
  function getQuarterMonths(quarter) {
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
  function getContributionRate(stats2) {
    const num = stats2.relevant_link_count + stats2.article_created_count + stats2.article_improved_count;
    const den = stats2.kb_potential_count + stats2.improvement_opportunity_count + stats2.create_opportunity_count;
    return den > 0 ? num / den : 0;
  }
  function getAccuracyRate(stats2) {
    return stats2.article_linked_count > 0 ? stats2.relevant_link_count / stats2.article_linked_count : 0;
  }
  function getLinkRate(stats2) {
    return stats2.kb_potential_count > 0 ? stats2.article_linked_count / stats2.kb_potential_count * 100 : 0;
  }
  stats = store_get($$store_subs ??= {}, "$reportStore", reportStore).individualStats[engineer.id];
  monthlyData = store_get($$store_subs ??= {}, "$reportStore", reportStore).monthlyData[engineer.id] || [];
  selectedQuarters = store_get($$store_subs ??= {}, "$reportStore", reportStore).filters.quarters || [];
  allowedMonths = selectedQuarters.length > 0 ? Array.from(new Set(selectedQuarters.flatMap((q) => getQuarterMonths(q)))) : monthlyData.map((d) => d.month_number);
  filteredMonthlyData = monthlyData.filter((d) => allowedMonths.includes(d.month_number));
  teamStats = store_get($$store_subs ??= {}, "$reportStore", reportStore).overallStats;
  $$payload.out += `<div class="card p-6 mb-8"><div class="flex items-center justify-between mb-6"><h2 class="text-xl font-semibold text-gray-900">${escape_html(engineer.name)}</h2> <a${attr("href", `/evaluations?engineer_id=${stringify(engineer.id)}`)} class="text-blue-600 hover:text-blue-800 text-sm">View Evaluations →</a></div> <div class="mb-4 text-sm text-gray-700"><span class="mr-6"><strong>Lead:</strong> ${escape_html(engineer.lead_name || "None")}</span> <span><strong>Coach:</strong> ${escape_html(engineer.coach_name || "None")}</span></div> `;
  if (stats) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="mb-6">`;
    RadarChart($$payload, {
      labels: [
        "Link Rate",
        "Contribution Rate",
        "Accuracy Rate",
        "Metric 4",
        "Metric 5",
        "Metric 6"
      ],
      teamData: [
        getLinkRate(teamStats),
        getContributionRate(teamStats) * 100,
        getAccuracyRate(teamStats) * 100,
        0,
        0,
        0
      ],
      personalData: [
        getLinkRate(stats),
        getContributionRate(stats) * 100,
        getAccuracyRate(stats) * 100,
        0,
        0,
        0
      ],
      width: 500,
      height: 500
    });
    $$payload.out += `<!----></div> <div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Link Rate <span title="Articles Linked / KB Potential" class="ml-1 text-gray-400 cursor-help">ℹ</span></h3> <p class="mt-2 flex items-center"><span${attr_class(`text-3xl font-semibold ${stringify(getLinkRateColorClass(getLinkRate(stats), store_get($$store_subs ??= {}, "$reportStore", reportStore).linkRateExpectation))}`, "svelte-39fzlp")}>${escape_html(formatPercentage(getLinkRate(stats)))}</span> <span class="ml-2 text-sm text-gray-500">vs ${escape_html(formatPercentage(store_get($$store_subs ??= {}, "$reportStore", reportStore).linkRateExpectation))}
                        target</span></p></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Contribution Rate <span title="(Relevant Links + Articles Created + Articles Improved) / (KB Potential + Improvement Opportunity + Create Opportunity)" class="ml-1 text-gray-400 cursor-help">ℹ</span></h3> <p class="mt-2"><span class="text-3xl font-semibold text-gray-900">${escape_html(formatPercentage(getContributionRate(stats) * 100))}</span></p></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500">Accuracy Rate <span title="Relevant Links / Articles Linked" class="ml-1 text-gray-400 cursor-help">ℹ</span></h3> <p class="mt-2"><span class="text-3xl font-semibold text-gray-900">${escape_html(formatPercentage(getAccuracyRate(stats) * 100))}</span></p></div></div> <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"><div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500 mb-4">KCS Performance</h3> <div class="space-y-2"><div class="flex justify-between"><span>Cases Evaluated</span> <span>${escape_html(stats.evaluated_cases)}</span></div> <div class="flex justify-between"><span>KB Potential</span> <span>${escape_html(stats.kb_potential_count)}</span></div> <div class="flex justify-between"><span>Linked Articles</span> <span>${escape_html(stats.article_linked_count)}</span></div> <div class="flex justify-between"><span>Relevant Links</span> <span>${escape_html(stats.relevant_link_count)}</span></div> <div class="flex justify-between"><span>Articles May Be Improved / Improved</span> <span>${escape_html(stats.improvement_opportunity_count)}/${escape_html(stats.article_improved_count)}</span></div> <div class="flex justify-between"><span>Articles May Be Created / Created</span> <span>${escape_html(stats.create_opportunity_count)}/${escape_html(stats.article_created_count)}</span></div></div></div> `;
    if (filteredMonthlyData.length > 0) {
      $$payload.out += "<!--[-->";
      const each_array = ensure_array_like(filteredMonthlyData);
      $$payload.out += `<div class="bg-white rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-medium text-gray-500 mb-4">Monthly Trend</h3> <table class="w-full text-left"><thead><tr><th class="px-2 py-1 text-sm font-medium text-gray-600">Month</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Link Rate</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Contribution</th><th class="px-2 py-1 text-sm font-medium text-gray-600">Accuracy</th></tr></thead><tbody><!--[-->`;
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let data = each_array[$$index];
        $$payload.out += `<tr><td class="px-2 py-1 text-sm text-gray-700">${escape_html(data.month)}</td><td${attr_class(`px-2 py-1 text-sm ${stringify(getLinkRateColorClass(getLinkRate(data.stats), store_get($$store_subs ??= {}, "$reportStore", reportStore).linkRateExpectation))}`, "svelte-39fzlp")}>${escape_html(formatPercentage(getLinkRate(data.stats)))}</td><td class="px-2 py-1 text-sm text-gray-700">${escape_html(formatPercentage(getContributionRate(data.stats) * 100))}</td><td class="px-2 py-1 text-sm text-gray-700">${escape_html(formatPercentage(getAccuracyRate(data.stats) * 100))}</td></tr>`;
      }
      $$payload.out += `<!--]--></tbody></table></div>`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<div class="text-center py-8 text-gray-500">No statistics available for this engineer.</div>`;
  }
  $$payload.out += `<!--]--></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { engineer });
  pop();
}
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let data = $$props["data"];
  if (!data.user) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="container mx-auto px-4 py-8"><div class="text-center"><h1 class="text-2xl font-bold text-gray-900">Please log in</h1> <p class="mt-2 text-gray-600">You need to be logged in to view this page.</p> <a href="/auth/login" class="mt-4 inline-block btn-primary">Log In</a></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<div class="min-h-screen bg-gray-50">`;
    Header($$payload, {
      title: "KCS Performance Report",
      user: data.user
    });
    $$payload.out += `<!----> <div class="container mx-auto px-4 py-8"><div class="flex justify-between items-center mb-8"><div class="text-sm text-gray-500">Last updated: ${escape_html((/* @__PURE__ */ new Date()).toLocaleString())}</div></div> `;
    ReportFilters($$payload, { user: data.user });
    $$payload.out += `<!----> `;
    if (store_get($$store_subs ??= {}, "$reportStore", reportStore).reportGenerated) {
      $$payload.out += "<!--[-->";
      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$selectedEngineers", selectedEngineers));
      ReportSummary($$payload);
      $$payload.out += `<!----> <!--[-->`;
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let engineer = each_array[$$index];
        EngineerStats($$payload, { engineer });
      }
      $$payload.out += `<!--]-->`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--> `;
    if (store_get($$store_subs ??= {}, "$reportStore", reportStore).error) {
      $$payload.out += "<!--[-->";
      $$payload.out += `<div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div> <div class="ml-3"><h3 class="text-sm font-medium text-red-800">Error</h3> <div class="mt-2 text-sm text-red-700"><p>${escape_html(store_get($$store_subs ??= {}, "$reportStore", reportStore).error)}</p></div></div></div></div>`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div></div>`;
  }
  $$payload.out += `<!--]-->`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { data });
  pop();
}
export {
  _page as default
};
