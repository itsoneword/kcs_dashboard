<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toast";
  import apiService from "$lib/api";
  import type { Evaluation, Engineer, User } from "$lib/types";
  import { authStore } from "$lib/stores/auth";
  import SearchableSelect from "$lib/components/SearchableSelect.svelte";
  import EvaluationFilters from "./components/EvaluationFilters.svelte";
  import ExcelImportModal from "$lib/components/evaluations/ExcelImportModal.svelte";
  import Header from "$lib/components/Header.svelte";

  let user: User | null = null;

  // Subscribe to auth store to get user
  authStore.subscribe((auth) => {
    user = auth.user;
  });
  let evaluations: Evaluation[] = [];
  let engineers: Engineer[] = [];
  let coaches: User[] = [];
  let leads: User[] = [];
  let isLoading = false;

  // Multi-select filter state
  let selectedEngineers: any[] = [];
  let selectedCoaches: any[] = [];
  let selectedLeads: any[] = [];
  let selectedYears: any[] = [];
  let selectedMonths: any[] = [];

  // Options for filters
  $: engineerOptions = engineers.map((eng) => ({
    value: eng.id,
    label: eng.name,
  }));
  $: coachOptions = coaches.map((coach) => ({
    value: coach.id,
    label: coach.name,
  }));
  $: leadOptions = leads.map((lead) => ({ value: lead.id, label: lead.name }));
  $: yearOptionsSelect = yearOptions.map((year) => ({
    value: year,
    label: year.toString(),
  }));
  $: monthOptionsSelect = monthOptions.map((month) => ({
    value: month.value,
    label: month.label,
  }));

  // Create evaluation modal
  let showCreateModal = false;
  let newEvaluation = {
    engineer_id: 0,
    evaluation_month: new Date().getMonth() + 1, // Current month (1-12)
    evaluation_year: new Date().getFullYear(),
  };

  // Excel Import modal
  let showImportModal = false;

  // Dropdown management for actions menu
  let activeDropdownId: string | null = null;

  function toggleDropdown(dropdownId: string) {
    if (activeDropdownId && activeDropdownId !== dropdownId) {
      const prev = document.getElementById(activeDropdownId);
      prev?.classList.add("hidden");
    }
    const el = document.getElementById(dropdownId);
    if (el) {
      el.classList.toggle("hidden");
      activeDropdownId = el.classList.contains("hidden") ? null : dropdownId;
    }
  }

  function closeAllDropdowns() {
    if (activeDropdownId) {
      const el = document.getElementById(activeDropdownId);
      el?.classList.add("hidden");
      activeDropdownId = null;
    }
  }

  // Available engineers for current user (for create evaluation)
  let availableEngineers: Engineer[] = [];

  onMount(() => {
    // Parse URL parameters on mount
    parseUrlParameters();

    // Add a small delay to ensure parsing is complete, then load data
    setTimeout(() => {
      loadDataWithMultipleMonths().catch(console.error);
    }, 100);

    // Close dropdowns when clicking outside
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".dropdown-menu") ||
        target.closest(".dropdown-toggle")
      ) {
        return;
      }
      closeAllDropdowns();
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  });

  // Reload available engineers when user changes
  $: if (user) {
    loadAvailableEngineers();
  }

  async function loadData() {
    try {
      isLoading = true;

      // Load evaluations, engineers, and users in parallel
      const [evaluationsResponse, engineersResponse, usersResponse] =
        await Promise.all([
          apiService.getAllEvaluations(getFilters()),
          apiService.getAllEngineers(),
          apiService.getAllUsers(),
        ]);

      evaluations = evaluationsResponse.evaluations;
      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter((u) => u.is_coach);
      leads = usersResponse.users.filter(
        (u) => u.is_lead || u.is_admin || u.is_manager,
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toastStore.add({ type: "error", message: "Failed to load data" });
    } finally {
      isLoading = false;
    }
  }

  async function loadAvailableEngineers() {
    try {
      if (user?.is_coach && !user?.is_admin && !user?.is_manager) {
        // Coaches can only see their assigned engineers
        const response = await apiService.getEngineersByCoach(user.id);
        availableEngineers = response.engineers;
      } else {
        // Admins can see all engineers
        const response = await apiService.getEngineersForEvaluation();
        availableEngineers = response.engineers;
      }
    } catch (error) {
      console.error("Error loading available engineers:", error);
    }
  }

  function getFilters() {
    const filters: any = {};
    if (selectedEngineers.length > 1) {
      filters.engineer_ids = selectedEngineers;
    } else if (selectedEngineers.length === 1) {
      filters.engineer_id = selectedEngineers[0];
    }
    if (selectedCoaches.length > 1) {
      filters.coach_user_ids = selectedCoaches;
    } else if (selectedCoaches.length === 1) {
      filters.coach_user_id = selectedCoaches[0];
    }
    if (selectedLeads.length > 1) {
      filters.lead_user_ids = selectedLeads;
    } else if (selectedLeads.length === 1) {
      filters.lead_user_id = selectedLeads[0];
    }
    if (selectedYears.length > 1) {
      filters.years = selectedYears;
    } else if (selectedYears.length === 1) {
      filters.year = selectedYears[0];
    }
    if (selectedMonths?.length > 0) {
      filters.months = selectedMonths;
    }
    return filters;
  }

  async function loadDataWithMultipleMonths() {
    try {
      isLoading = true;

      // Handle month filtering: support single or multiple
      if (selectedMonths.length > 1) {
        const allEvaluations: Evaluation[] = [];
        for (const monthId of selectedMonths) {
          const f = getFilters();
          f.month = monthId;
          try {
            const response = await apiService.getAllEvaluations(f);
            allEvaluations.push(...response.evaluations);
          } catch (error) {
            console.error(`Error loading data for month ${monthId}:`, error);
          }
        }
        // Remove duplicates based on evaluation ID
        evaluations = allEvaluations.filter(
          (ev, idx, arr) => idx === arr.findIndex((e) => e.id === ev.id),
        );
      } else {
        const f = getFilters();
        if (selectedMonths.length === 1) f.month = selectedMonths[0];
        const response = await apiService.getAllEvaluations(f);
        evaluations = response.evaluations;
      }

      // Load other data in parallel
      const [engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEngineers(),
        apiService.getAllUsers(),
      ]);

      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter((u) => u.is_coach);
      leads = usersResponse.users.filter(
        (u) => u.is_lead || u.is_admin || u.is_manager,
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toastStore.add({ type: "error", message: "Failed to load data" });
    } finally {
      isLoading = false;
    }
  }

  async function applyFilters() {
    await loadDataWithMultipleMonths();
  }

  function clearFilters() {
    selectedEngineers = [];
    selectedCoaches = [];
    selectedLeads = [];
    selectedYears = [];
    selectedMonths = [];
    if (user?.is_coach) {
      selectedCoaches = [user.id];
      applyFilters();
    } else if (user?.is_lead) {
      selectedLeads = [user.id];
      applyFilters();
    }
  }

  async function createEvaluation() {
    try {
      if (
        !newEvaluation.engineer_id ||
        !newEvaluation.evaluation_month ||
        !newEvaluation.evaluation_year
      ) {
        toastStore.add({
          type: "warning",
          message: "Please fill in all required fields",
        });
        return;
      }

      // Convert month/year to date (first day of the month)
      const evaluationDate = `${newEvaluation.evaluation_year}-${newEvaluation.evaluation_month.toString().padStart(2, "0")}-01`;

      const { evaluation } = await apiService.createEvaluation({
        engineer_id: newEvaluation.engineer_id,
        evaluation_date: evaluationDate,
      });
      showCreateModal = false;
      newEvaluation = {
        engineer_id: 0,
        evaluation_month: new Date().getMonth() + 1,
        evaluation_year: new Date().getFullYear(),
      };
      toastStore.add({
        type: "success",
        message: "Evaluation created successfully",
      });
      goto(`/evaluations/${evaluation.id}`);
    } catch (error: any) {
      console.error("Error creating evaluation:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to create evaluation";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  function viewEvaluation(evaluationId: number) {
    goto(`/evaluations/${evaluationId}`);
  }

  /**
   * Delete an evaluation and refresh list
   */
  async function removeEvaluation(evaluationId: number) {
    if (!confirm("Are you sure you want to delete this evaluation?")) return;
    try {
      await apiService.deleteEvaluation(evaluationId);
      toastStore.add({
        type: "success",
        message: "Evaluation deleted successfully",
      });
      loadDataWithMultipleMonths();
    } catch (error: any) {
      console.error("Delete evaluation error:", error);
      const msg = error.response?.data?.error || "Failed to delete evaluation";
      toastStore.add({ type: "error", message: msg });
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function formatEvaluationMonth(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function getEngineerName(engineerId: number): string {
    const engineer = engineers.find((e) => e.id === engineerId);
    return engineer?.name || "Unknown";
  }

  function getCoachName(coachId: number): string {
    const coach = coaches.find((c) => c.id === coachId);
    return coach?.name || "Unknown";
  }

  // Generate year options (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Month options
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
    { value: 12, label: "December" },
  ];

  // Excel Import modal handlers
  function handleImportSuccess() {
    showImportModal = false;
    loadData(); // Reload data to show imported evaluations
    toastStore.add({
      type: "success",
      message: "Data imported successfully! Refreshing evaluations...",
    });
  }

  // Parse URL parameters for direct links
  function parseUrlParameters() {
    const params = new URLSearchParams($page.url.search);

    // Parse engineer ID (single)
    const engineerId = params.get("engineer_id");
    if (engineerId && !isNaN(parseInt(engineerId))) {
      selectedEngineers = [parseInt(engineerId)];
    }

    // Parse engineer IDs (multiple or single)
    const engineerIds = params.getAll("engineer_ids");
    if (engineerIds.length > 0) {
      // If we have engineer_ids parameter, use the first valid one
      const firstValidId = engineerIds.find((id) => !isNaN(parseInt(id)));
      if (firstValidId) {
        selectedEngineers = [parseInt(firstValidId)];
      }
    }

    // Parse coach user ID
    const coachUserId = params.get("coach_user_id");
    if (coachUserId && !isNaN(parseInt(coachUserId))) {
      selectedCoaches = [parseInt(coachUserId)];
    }

    // Parse lead user ID
    const leadUserId = params.get("lead_user_id");
    if (leadUserId && !isNaN(parseInt(leadUserId))) {
      selectedLeads = [parseInt(leadUserId)];
    }

    // Parse year
    const year = params.get("year");
    if (year && !isNaN(parseInt(year))) {
      selectedYears = [parseInt(year)];
    }

    // Parse month (single) - for backward compatibility
    const month = params.get("month");
    if (month && !isNaN(parseInt(month))) {
      selectedMonths = [parseInt(month)];
    }

    // Parse months array (new multiple month support)
    const months = params.getAll("months");
    if (months.length > 0) {
      const validMonths = months
        .map((m) => parseInt(m))
        .filter((m) => !isNaN(m) && m >= 1 && m <= 12);
      if (validMonths.length > 0) {
        selectedMonths = validMonths;
      }
    }

    console.log(
      "Parsed URL parameters:",
      selectedEngineers,
      selectedCoaches,
      selectedLeads,
      selectedYears,
      selectedMonths,
    );
  }

  async function handleLogout() {
    await authStore.logout();
    goto("/login");
  }
</script>

<svelte:head>
  <title>Evaluations - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex justify-center items-center py-8">
    <div
      class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
    ></div>
  </div>
{:else if !user}
  <div class="text-center py-8">
    <p class="text-gray-500">Please log in to view evaluations.</p>
    <a href="/auth/login" class="text-blue-600 hover:text-blue-800">Login</a>
  </div>
{:else}
  <div class="min-h-screen bg-gray-50">
    <Header title="Evaluations" {user} />

    <div class="container mx-auto px-4 py-8">
      <!-- Header with Actions -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Evaluations</h2>
          <p class="text-gray-600">View and manage evaluations</p>
        </div>

        <div class="flex items-center space-x-4">
          {#if user.is_coach || user.is_lead || user.is_manager}
            <button on:click={clearFilters} class="btn-secondary text-sm">
              My Workers
            </button>
          {/if}

          {#if user.is_admin || user.is_coach || user.is_lead || user.is_manager}
            <button
              on:click={() => (showImportModal = true)}
              class="btn-secondary text-sm flex items-center gap-2"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Import Excel
            </button>

            <button
              on:click={() => (showCreateModal = true)}
              class="btn-primary text-sm"
            >
              Create Evaluation
            </button>
          {/if}
        </div>
      </div>

      <!-- Filters -->
      <EvaluationFilters
        engineers={engineerOptions}
        coaches={coachOptions}
        leads={leadOptions}
        years={yearOptionsSelect}
        months={monthOptionsSelect}
        bind:selectedEngineers
        bind:selectedCoaches
        bind:selectedLeads
        bind:selectedYears
        bind:selectedMonths
        on:change={() => applyFilters()}
      />
    </div>

    <!-- Evaluations Table -->
    <div
      class="container mx-auto px-4 bg-white rounded-lg shadow-md overflow-visible mt-6 max-h-[600px] overflow-visible"
    >
      {#if isLoading}
        <div class="flex justify-center items-center py-8">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          ></div>
        </div>
      {:else if evaluations.length === 0}
        <div class="text-center py-8 text-gray-500">
          No evaluations found. {#if user?.is_admin || user?.is_coach}Try
            creating one!{/if}
        </div>
      {:else}
        <div class="overflow-x-auto overflow-visible">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Engineer
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Coach
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Lead
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Evaluated Month
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Cases
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each evaluations as evaluation}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {evaluation.engineer_name ||
                        getEngineerName(evaluation.engineer_id)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {evaluation.coach_name ||
                        getCoachName(evaluation.coach_user_id)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {evaluation.lead_name || "N/A"}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {formatEvaluationMonth(evaluation.evaluation_date)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {evaluation.case_count || 0}
                    </div>
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm font-medium overflow-visible"
                  >
                    <div class="flex items-center gap-2">
                      <button
                        on:click={() => viewEvaluation(evaluation.id)}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                      {#if user?.is_admin || user?.is_coach || user?.is_manager}
                        {#key evaluation.id}
                          {@const dropdownId = `eval-dropdown-${evaluation.id}`}
                          <div
                            class="relative inline-block text-left overflow-visible"
                          >
                            <button
                              class="dropdown-toggle cursor-pointer text-gray-600 hover:text-gray-900 px-1"
                              aria-expanded={dropdownId === activeDropdownId}
                              aria-haspopup="true"
                              on:click={() => toggleDropdown(dropdownId)}
                            >
                              ⋮
                            </button>
                            <div
                              id={dropdownId}
                              class="dropdown-menu hidden origin-top-right absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow text-sm w-32 z-50"
                              role="menu"
                              aria-orientation="vertical"
                            >
                              <button
                                on:click={() => {
                                  removeEvaluation(evaluation.id);
                                  closeAllDropdowns();
                                }}
                                class="block w-full px-4 py-2 hover:bg-gray-100 text-left text-red-600"
                                role="menuitem"
                              >
                                Delete evaluation
                              </button>
                            </div>
                          </div>
                        {/key}
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    {#if !isLoading && evaluations.length === 0}
      <div class="text-center py-8 text-gray-500">
        No evaluations found. {#if user?.is_admin || user?.is_coach}Try creating
          one!{/if}
      </div>
    {/if}

    <!-- Create Evaluation Modal -->
    {#if showCreateModal}
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 class="text-lg font-medium mb-4">Create New Evaluation</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Engineer *
              </label>
              <SearchableSelect
                options={availableEngineers.map((eng) => ({
                  value: eng.id,
                  label: eng.name,
                }))}
                bind:value={newEvaluation.engineer_id}
                placeholder="Select an engineer..."
                searchPlaceholder="Search engineers..."
                on:change={(e) => (newEvaluation.engineer_id = e.detail.value)}
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Month *
                </label>
                <select
                  bind:value={newEvaluation.evaluation_month}
                  class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {#each monthOptions as month}
                    <option value={month.value}>
                      {month.label}
                    </option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Year *
                </label>
                <select
                  bind:value={newEvaluation.evaluation_year}
                  class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {#each yearOptions as year}
                    <option value={year}>{year}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button
                on:click={() => (showCreateModal = false)}
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                on:click={createEvaluation}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if showImportModal}
      <ExcelImportModal
        show={showImportModal}
        {user}
        on:close={() => (showImportModal = false)}
        on:success={handleImportSuccess}
      />
    {/if}
  </div>
{/if}
