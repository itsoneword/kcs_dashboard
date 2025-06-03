import { p as push, s as setContext, k as copy_payload, l as assign_payload, m as bind_props, a as pop, h as head, e as ensure_array_like, c as escape_html, j as attr } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "../../../chunks/toast.js";
import { a as apiService } from "../../../chunks/api.js";
import { a as authStore } from "../../../chunks/auth.js";
import { M as MultiSelectSearchable, H as Header } from "../../../chunks/Header.js";
import { y as fallback } from "../../../chunks/utils.js";
import { w as writable } from "../../../chunks/index.js";
function EvaluationFilters($$payload, $$props) {
  push();
  let engineers = fallback($$props["engineers"], () => [], true);
  let coaches = fallback($$props["coaches"], () => [], true);
  let leads = fallback($$props["leads"], () => [], true);
  let years = fallback($$props["years"], () => [], true);
  let months = fallback($$props["months"], () => [], true);
  let selectedEngineers = fallback($$props["selectedEngineers"], () => [], true);
  let selectedCoaches = fallback($$props["selectedCoaches"], () => [], true);
  let selectedLeads = fallback($$props["selectedLeads"], () => [], true);
  let selectedYears = fallback($$props["selectedYears"], () => [], true);
  let selectedMonths = fallback($$props["selectedMonths"], () => [], true);
  const openDropdown = writable(null);
  setContext("dropdownGroup", { openDropdown });
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out += `<div class="container mx-auto px-4 bg-white rounded-lg shadow-md p-6 mb-6"><h2 class="text-lg font-semibold mb-4">Filters</h2> <div class="grid grid-cols-1 md:grid-cols-5 gap-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Engineer</label> `;
    MultiSelectSearchable($$payload2, {
      group: "engineer",
      options: engineers,
      placeholder: "All Engineers",
      searchPlaceholder: "Search engineers...",
      get values() {
        return selectedEngineers;
      },
      set values($$value) {
        selectedEngineers = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Coach</label> `;
    MultiSelectSearchable($$payload2, {
      group: "coach",
      options: coaches,
      placeholder: "All Coaches",
      searchPlaceholder: "Search coaches...",
      get values() {
        return selectedCoaches;
      },
      set values($$value) {
        selectedCoaches = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Lead</label> `;
    MultiSelectSearchable($$payload2, {
      group: "lead",
      options: leads,
      placeholder: "All Leads",
      searchPlaceholder: "Search leads...",
      get values() {
        return selectedLeads;
      },
      set values($$value) {
        selectedLeads = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Year</label> `;
    MultiSelectSearchable($$payload2, {
      group: "year",
      options: years,
      placeholder: "All Years",
      searchPlaceholder: "Search years...",
      get values() {
        return selectedYears;
      },
      set values($$value) {
        selectedYears = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div> <div><label class="block text-sm font-medium text-gray-700 mb-1">Month</label> `;
    MultiSelectSearchable($$payload2, {
      group: "month",
      options: months,
      placeholder: "All Months",
      searchPlaceholder: "Search months...",
      get values() {
        return selectedMonths;
      },
      set values($$value) {
        selectedMonths = $$value;
        $$settled = false;
      }
    });
    $$payload2.out += `<!----></div></div> <div class="flex gap-2 mt-4"><button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Apply Filters</button> <button class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">Clear Filters</button></div></div>`;
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, {
    engineers,
    coaches,
    leads,
    years,
    months,
    selectedEngineers,
    selectedCoaches,
    selectedLeads,
    selectedYears,
    selectedMonths
  });
  pop();
}
function _page($$payload, $$props) {
  push();
  let engineerOptions, coachOptions, leadOptions, yearOptionsSelect, monthOptionsSelect;
  let user = null;
  authStore.subscribe((auth) => {
    user = auth.user;
  });
  let evaluations = [];
  let engineers = [];
  let coaches = [];
  let leads = [];
  let selectedEngineers = [];
  let selectedCoaches = [];
  let selectedLeads = [];
  let selectedYears = [];
  let selectedMonths = [];
  ({
    evaluation_month: (/* @__PURE__ */ new Date()).getMonth() + 1,
    // Current month (1-12)
    evaluation_year: (/* @__PURE__ */ new Date()).getFullYear()
  });
  let activeDropdownId = null;
  let availableEngineers = [];
  async function loadAvailableEngineers() {
    try {
      if (user?.is_coach && !user?.is_admin && !user?.is_manager) {
        const response = await apiService.getEngineersByCoach(user.id);
        availableEngineers = response.engineers;
      } else {
        const response = await apiService.getEngineersForEvaluation();
        availableEngineers = response.engineers;
      }
    } catch (error) {
      console.error("Error loading available engineers:", error);
    }
  }
  function formatEvaluationMonth(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  function getEngineerName(engineerId) {
    const engineer = engineers.find((e) => e.id === engineerId);
    return engineer?.name || "Unknown";
  }
  function getCoachName(coachId) {
    const coach = coaches.find((c) => c.id === coachId);
    return coach?.name || "Unknown";
  }
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);
  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" }
  ];
  engineerOptions = engineers.map((eng) => ({ value: eng.id, label: eng.name }));
  coachOptions = coaches.map((coach) => ({ value: coach.id, label: coach.name }));
  leadOptions = leads.map((lead) => ({ value: lead.id, label: lead.name }));
  yearOptionsSelect = yearOptions.map((year) => ({ value: year, label: year.toString() }));
  monthOptionsSelect = monthOptions.map((month) => ({ value: month.value, label: month.label }));
  if (user) {
    loadAvailableEngineers();
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Evaluations - KCS Portal</title>`;
    });
    if (!user) {
      $$payload2.out += "<!--[1-->";
      $$payload2.out += `<div class="text-center py-8"><p class="text-gray-500">Please log in to view evaluations.</p> <a href="/auth/login" class="text-blue-600 hover:text-blue-800">Login</a></div>`;
    } else {
      $$payload2.out += "<!--[!-->";
      $$payload2.out += `<div class="min-h-screen bg-gray-50">`;
      Header($$payload2, { title: "Evaluations", user });
      $$payload2.out += `<!----> <div class="container mx-auto px-4 py-8"><div class="flex justify-between items-center mb-6"><div><h2 class="text-2xl font-bold text-gray-900">Evaluations</h2> <p class="text-gray-600">View and manage evaluations</p></div> <div class="flex items-center space-x-4">`;
      if (user.is_coach || user.is_lead || user.is_manager) {
        $$payload2.out += "<!--[-->";
        $$payload2.out += `<button class="btn-secondary text-sm">My Workers</button>`;
      } else {
        $$payload2.out += "<!--[!-->";
      }
      $$payload2.out += `<!--]--> `;
      if (user.is_admin || user.is_coach || user.is_lead || user.is_manager) {
        $$payload2.out += "<!--[-->";
        $$payload2.out += `<button class="btn-secondary text-sm flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg> Import Excel</button> <button class="btn-primary text-sm">Create Evaluation</button>`;
      } else {
        $$payload2.out += "<!--[!-->";
      }
      $$payload2.out += `<!--]--></div></div> `;
      EvaluationFilters($$payload2, {
        engineers: engineerOptions,
        coaches: coachOptions,
        leads: leadOptions,
        years: yearOptionsSelect,
        months: monthOptionsSelect,
        get selectedEngineers() {
          return selectedEngineers;
        },
        set selectedEngineers($$value) {
          selectedEngineers = $$value;
          $$settled = false;
        },
        get selectedCoaches() {
          return selectedCoaches;
        },
        set selectedCoaches($$value) {
          selectedCoaches = $$value;
          $$settled = false;
        },
        get selectedLeads() {
          return selectedLeads;
        },
        set selectedLeads($$value) {
          selectedLeads = $$value;
          $$settled = false;
        },
        get selectedYears() {
          return selectedYears;
        },
        set selectedYears($$value) {
          selectedYears = $$value;
          $$settled = false;
        },
        get selectedMonths() {
          return selectedMonths;
        },
        set selectedMonths($$value) {
          selectedMonths = $$value;
          $$settled = false;
        }
      });
      $$payload2.out += `<!----></div> <div class="container mx-auto px-4 bg-white rounded-lg shadow-md overflow-visible mt-6 max-h-[600px] overflow-visible">`;
      if (evaluations.length === 0) {
        $$payload2.out += "<!--[1-->";
        $$payload2.out += `<div class="text-center py-8 text-gray-500">No evaluations found. `;
        if (user?.is_admin || user?.is_coach) {
          $$payload2.out += "<!--[-->";
          $$payload2.out += `Try
            creating one!`;
        } else {
          $$payload2.out += "<!--[!-->";
        }
        $$payload2.out += `<!--]--></div>`;
      } else {
        $$payload2.out += "<!--[!-->";
        const each_array = ensure_array_like(evaluations);
        $$payload2.out += `<div class="overflow-x-auto overflow-visible"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engineer</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coach</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evaluated Month</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cases</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody class="bg-white divide-y divide-gray-200"><!--[-->`;
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let evaluation = each_array[$$index];
          $$payload2.out += `<tr class="hover:bg-gray-50"><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escape_html(evaluation.engineer_name || getEngineerName(evaluation.engineer_id))}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${escape_html(evaluation.coach_name || getCoachName(evaluation.coach_user_id))}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${escape_html(evaluation.lead_name || "N/A")}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${escape_html(formatEvaluationMonth(evaluation.evaluation_date))}</div></td><td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${escape_html(evaluation.case_count || 0)}</div></td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium overflow-visible"><div class="flex items-center gap-2"><button class="text-blue-600 hover:text-blue-900">View Details</button> `;
          if (user?.is_admin || user?.is_coach || user?.is_manager) {
            $$payload2.out += "<!--[-->";
            $$payload2.out += `<!---->`;
            {
              const dropdownId = `eval-dropdown-${evaluation.id}`;
              $$payload2.out += `<div class="relative inline-block text-left overflow-visible"><button class="dropdown-toggle cursor-pointer text-gray-600 hover:text-gray-900 px-1"${attr("aria-expanded", dropdownId === activeDropdownId)} aria-haspopup="true">⋮</button> <div${attr("id", dropdownId)} class="dropdown-menu hidden origin-top-right absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow text-sm w-32 z-50" role="menu" aria-orientation="vertical"><button class="block w-full px-4 py-2 hover:bg-gray-100 text-left text-red-600" role="menuitem">Delete evaluation</button></div></div>`;
            }
            $$payload2.out += `<!---->`;
          } else {
            $$payload2.out += "<!--[!-->";
          }
          $$payload2.out += `<!--]--></div></td></tr>`;
        }
        $$payload2.out += `<!--]--></tbody></table></div>`;
      }
      $$payload2.out += `<!--]--></div> `;
      if (evaluations.length === 0) {
        $$payload2.out += "<!--[-->";
        $$payload2.out += `<div class="text-center py-8 text-gray-500">No evaluations found. `;
        if (user?.is_admin || user?.is_coach) {
          $$payload2.out += "<!--[-->";
          $$payload2.out += `Try creating
          one!`;
        } else {
          $$payload2.out += "<!--[!-->";
        }
        $$payload2.out += `<!--]--></div>`;
      } else {
        $$payload2.out += "<!--[!-->";
      }
      $$payload2.out += `<!--]--> `;
      {
        $$payload2.out += "<!--[!-->";
      }
      $$payload2.out += `<!--]--> `;
      {
        $$payload2.out += "<!--[!-->";
      }
      $$payload2.out += `<!--]--></div>`;
    }
    $$payload2.out += `<!--]-->`;
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
export {
  _page as default
};
