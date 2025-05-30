<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { toastStore } from '$lib/stores/toast';
  import apiService from '$lib/api';
  import type { Evaluation, Engineer, User } from '$lib/types';
  import { authStore } from '$lib/stores/auth';
  import SearchableSelect from '$lib/components/SearchableSelect.svelte';
  import ExcelImportModal from '$lib/components/evaluations/ExcelImportModal.svelte';

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

  // Filter state
  let selectedFilters = {
    engineer_id: '',
    coach_user_id: '',
    lead_user_id: '',
    year: '',
    month: '' // Keep for backward compatibility
  };

  // Multiple month selection (new)
  let selectedMonthIds: number[] = [];
  let showMonthDropdown = false;
  let monthSearchTerm = '';
  let filteredMonths: typeof monthOptions = [];
  let monthDisplayText = 'All Months';

  // Create evaluation modal
  let showCreateModal = false;
  let newEvaluation = {
    engineer_id: 0,
    evaluation_month: new Date().getMonth() + 1, // Current month (1-12)
    evaluation_year: new Date().getFullYear()
  };

  // Excel Import modal
  let showImportModal = false;

  // Available engineers for current user (for create evaluation)
  let availableEngineers: Engineer[] = [];

  onMount(async () => {
    // Parse URL parameters on mount
    parseUrlParameters();
    
    // Add a small delay to ensure parsing is complete, then load data
    await new Promise(resolve => setTimeout(resolve, 100));
    loadDataWithMultipleMonths();
  });

  // Reload available engineers when user changes
  $: if (user) {
    loadAvailableEngineers();
  }

  async function loadData() {
    try {
      isLoading = true;
      
      // Load evaluations, engineers, and users in parallel
      const [evaluationsResponse, engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEvaluations(getFilters()),
        apiService.getAllEngineers(),
        apiService.getAllUsers()
      ]);

      evaluations = evaluationsResponse.evaluations;
      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter(u => u.is_coach);
      leads = usersResponse.users.filter(u => u.is_lead || u.is_admin);
    } catch (error) {
      console.error('Error loading data:', error);
      toastStore.add({ type: 'error', message: 'Failed to load data' });
    } finally {
      isLoading = false;
    }
  }

  async function loadAvailableEngineers() {
    try {
      if (user?.is_coach && !user?.is_admin) {
        // Coaches can only see their assigned engineers
        const response = await apiService.getEngineersByCoach(user.id);
        availableEngineers = response.engineers;
      } else {
        // Admins can see all engineers
        const response = await apiService.getEngineersForEvaluation();
        availableEngineers = response.engineers;
      }
    } catch (error) {
      console.error('Error loading available engineers:', error);
    }
  }

  function getFilters() {
    const filters: any = {};
    if (selectedFilters.engineer_id) filters.engineer_id = parseInt(selectedFilters.engineer_id);
    if (selectedFilters.coach_user_id) filters.coach_user_id = parseInt(selectedFilters.coach_user_id);
    if (selectedFilters.lead_user_id) filters.lead_user_id = parseInt(selectedFilters.lead_user_id);
    if (selectedFilters.year) filters.year = parseInt(selectedFilters.year);
    
    // Handle multiple months or single month
    if (selectedMonthIds.length === 1) {
      filters.month = selectedMonthIds[0];
    } else if (selectedFilters.month) {
      // Fallback to single month for backward compatibility
      filters.month = parseInt(selectedFilters.month);
    }
    // Note: If multiple months are selected, we'll need to handle this differently
    
    console.log('Applied filters:', filters);
    console.log('Selected months for filtering:', selectedMonthIds);
    return filters;
  }

  async function loadDataWithMultipleMonths() {
    try {
      isLoading = true;
      
      // If we have multiple months selected, we need to fetch data for all months
      // and combine the results
      if (selectedMonthIds.length > 1) {
        const allEvaluations: Evaluation[] = [];
        
        for (const monthId of selectedMonthIds) {
          const monthFilters = getFilters();
          monthFilters.month = monthId;
          
          try {
            const response = await apiService.getAllEvaluations(monthFilters);
            allEvaluations.push(...response.evaluations);
          } catch (error) {
            console.error(`Error loading data for month ${monthId}:`, error);
          }
        }
        
        // Remove duplicates based on evaluation ID
        const uniqueEvaluations = allEvaluations.filter((evaluation, index, self) => 
          index === self.findIndex(e => e.id === evaluation.id)
        );
        
        evaluations = uniqueEvaluations;
      } else {
        // Single month or no month filter - use regular approach
        const response = await apiService.getAllEvaluations(getFilters());
        evaluations = response.evaluations;
      }
      
      // Load other data in parallel
      const [engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEngineers(),
        apiService.getAllUsers()
      ]);

      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter(u => u.is_coach);
      leads = usersResponse.users.filter(u => u.is_lead || u.is_admin);
    } catch (error) {
      console.error('Error loading data:', error);
      toastStore.add({ type: 'error', message: 'Failed to load data' });
    } finally {
      isLoading = false;
    }
  }

  async function applyFilters() {
    await loadDataWithMultipleMonths();
  }

  function clearFilters() {
    selectedFilters = {
      engineer_id: '',
      coach_user_id: '',
      lead_user_id: '',
      year: '',
      month: ''
    };
    applyFilters();
  }

  function setMyWorkersFilter() {
    if (user?.is_coach) {
      selectedFilters.coach_user_id = user.id.toString();
      applyFilters();
    } else if (user?.is_lead) {
      selectedFilters.lead_user_id = user.id.toString();
      applyFilters();
    }
  }

  async function createEvaluation() {
    try {
      if (!newEvaluation.engineer_id || !newEvaluation.evaluation_month || !newEvaluation.evaluation_year) {
        toastStore.add({ type: 'warning', message: 'Please fill in all required fields' });
        return;
      }

      // Convert month/year to date (first day of the month)
      const evaluationDate = `${newEvaluation.evaluation_year}-${newEvaluation.evaluation_month.toString().padStart(2, '0')}-01`;
      
      await apiService.createEvaluation({
        engineer_id: newEvaluation.engineer_id,
        evaluation_date: evaluationDate
      });
      
      showCreateModal = false;
      newEvaluation = { 
        engineer_id: 0, 
        evaluation_month: new Date().getMonth() + 1,
        evaluation_year: new Date().getFullYear()
      };
      toastStore.add({ type: 'success', message: 'Evaluation created successfully' });
      await loadData();
    } catch (error: any) {
      console.error('Error creating evaluation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create evaluation';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  function viewEvaluation(evaluationId: number) {
    goto(`/evaluations/${evaluationId}`);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function formatEvaluationMonth(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function getEngineerName(engineerId: number): string {
    const engineer = engineers.find(e => e.id === engineerId);
    return engineer?.name || 'Unknown';
  }

  function getCoachName(coachId: number): string {
    const coach = coaches.find(c => c.id === coachId);
    return coach?.name || 'Unknown';
  }

  // Generate year options (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  // Excel Import modal handlers
  function handleImportSuccess() {
    showImportModal = false;
    loadData(); // Reload data to show imported evaluations
    toastStore.add({ type: 'success', message: 'Data imported successfully! Refreshing evaluations...' });
  }

  // Parse URL parameters for direct links
  function parseUrlParameters() {
    const params = new URLSearchParams($page.url.search);
    
    // Parse engineer ID (single)
    const engineerId = params.get('engineer_id');
    if (engineerId && !isNaN(parseInt(engineerId))) {
      selectedFilters.engineer_id = engineerId;
    }
    
    // Parse engineer IDs (multiple or single)
    const engineerIds = params.getAll('engineer_ids');
    if (engineerIds.length > 0) {
      // If we have engineer_ids parameter, use the first valid one
      const firstValidId = engineerIds.find(id => !isNaN(parseInt(id)));
      if (firstValidId) {
        selectedFilters.engineer_id = firstValidId;
      }
    }
    
    // Parse coach user ID
    const coachUserId = params.get('coach_user_id');
    if (coachUserId && !isNaN(parseInt(coachUserId))) {
      selectedFilters.coach_user_id = coachUserId;
    }
    
    // Parse lead user ID
    const leadUserId = params.get('lead_user_id');
    if (leadUserId && !isNaN(parseInt(leadUserId))) {
      selectedFilters.lead_user_id = leadUserId;
    }
    
    // Parse year
    const year = params.get('year');
    if (year && !isNaN(parseInt(year))) {
      selectedFilters.year = year;
    }
    
    // Parse month (single) - for backward compatibility
    const month = params.get('month');
    if (month && !isNaN(parseInt(month))) {
      selectedFilters.month = month;
      selectedMonthIds = [parseInt(month)];
    }
    
    // Parse months array (new multiple month support)
    const months = params.getAll('months');
    if (months.length > 0) {
      const validMonths = months.map(m => parseInt(m)).filter(m => !isNaN(m) && m >= 1 && m <= 12);
      if (validMonths.length > 0) {
        selectedMonthIds = validMonths;
        // Clear single month for consistency
        selectedFilters.month = '';
      }
    }
    
    // Update month display text
    updateMonthDisplayText();
    
    console.log('Parsed URL parameters:', selectedFilters);
    console.log('Selected months:', selectedMonthIds);
  }

  function updateMonthDisplayText() {
    if (selectedMonthIds.length === 1) {
      const month = monthOptions.find(m => m.value === selectedMonthIds[0]);
      monthDisplayText = month?.label || 'All Months';
    } else if (selectedMonthIds.length > 1) {
      monthDisplayText = 'Multiple Months';
    } else {
      monthDisplayText = 'All Months';
    }
  }

  // Month filtering and selection functions
  function filterMonths(searchTerm: string) {
    filteredMonths = searchTerm ? 
      monthOptions.filter(month => 
        month.label.toLowerCase().includes(searchTerm.toLowerCase())
      ) : monthOptions;
  }

  function selectMonth(month: typeof monthOptions[0] | null) {
    if (month) {
      const index = selectedMonthIds.indexOf(month.value);
      if (index > -1) {
        selectedMonthIds = selectedMonthIds.filter(id => id !== month.value);
      } else {
        selectedMonthIds = [...selectedMonthIds, month.value];
      }
    } else {
      selectedMonthIds = [];
    }
    updateMonthDisplayText();
  }

  function isMonthSelected(monthId: number): boolean {
    return selectedMonthIds.includes(monthId);
  }

  // Initialize filtered months
  $: filteredMonths = monthOptions;

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Evaluations - KCS Portal</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Navigation Header -->
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center space-x-4">
          <a href="/dashboard" class="text-primary-600 hover:text-primary-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <h1 class="text-xl font-semibold text-gray-900">Evaluations</h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700">Welcome, {user?.name || 'User'}</span>
          {#if user?.is_admin}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Admin</span>
          {:else if user?.is_lead}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Lead</span>
          {:else if user?.is_coach}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Coach</span>
          {/if}
          
          {#if user?.is_coach || user?.is_lead}
            <button
              on:click={setMyWorkersFilter}
              class="btn-secondary text-sm"
            >
              My Workers
            </button>
          {/if}
          
          {#if user?.is_admin || user?.is_coach}
            <button
              on:click={() => showImportModal = true}
              class="btn-secondary text-sm flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Import Excel
            </button>
            
            <button
              on:click={() => showCreateModal = true}
              class="btn-primary text-sm"
            >
              Create Evaluation
            </button>
          {/if}
          
          <button on:click={handleLogout} class="btn-secondary text-sm">Logout</button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="px-4 py-6 sm:px-0">

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Filters</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- Engineer Filter -->
          <div>
            <label for="engineer-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Engineer
            </label>
            <select
              id="engineer-filter"
              bind:value={selectedFilters.engineer_id}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Engineers</option>
              {#each engineers as engineer}
                <option value={engineer.id}>{engineer.name}</option>
              {/each}
            </select>
          </div>

          <!-- Coach Filter -->
          <div>
            <label for="coach-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Coach
            </label>
            <select
              id="coach-filter"
              bind:value={selectedFilters.coach_user_id}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Coaches</option>
              {#each coaches as coach}
                <option value={coach.id}>{coach.name}</option>
              {/each}
            </select>
          </div>

          <!-- Lead Filter -->
          <div>
            <label for="lead-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Lead
            </label>
            <select
              id="lead-filter"
              bind:value={selectedFilters.lead_user_id}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Leads</option>
              {#each leads as lead}
                <option value={lead.id}>{lead.name}</option>
              {/each}
            </select>
          </div>

          <!-- Year Filter -->
          <div>
            <label for="year-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              id="year-filter"
              bind:value={selectedFilters.year}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {#each yearOptions as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>

          <!-- Month Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Months</label>
            <div class="relative">
              <input 
                type="text" 
                placeholder="Search months or select all..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={showMonthDropdown ? monthSearchTerm : monthDisplayText}
                on:input={(e) => {
                  monthSearchTerm = e.target.value;
                  filterMonths(monthSearchTerm);
                  showMonthDropdown = true;
                }}
                on:focus={() => {
                  monthSearchTerm = '';
                  showMonthDropdown = true;
                  filterMonths('');
                }}
                on:blur={() => setTimeout(() => showMonthDropdown = false, 200)}
              />
              
              {#if showMonthDropdown}
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  <button type="button" class="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-200 flex items-center space-x-2" on:mousedown|preventDefault={() => selectMonth(null)}>
                    <input type="checkbox" checked={selectedMonthIds.length === 0} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" readonly />
                    <span class="font-medium text-gray-900">All Months</span>
                  </button>
                  {#each filteredMonths as month}
                    <button type="button" class="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2 {isMonthSelected(month.value) ? 'bg-blue-50' : ''}" on:mousedown|preventDefault={() => selectMonth(month)}>
                      <input type="checkbox" checked={isMonthSelected(month.value)} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" readonly />
                      <span class="{isMonthSelected(month.value) ? 'text-blue-700 font-medium' : 'text-gray-900'}">{month.label}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-4">
          <button
            on:click={applyFilters}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
          <button
            on:click={clearFilters}
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Evaluations Table -->
      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        {#if isLoading}
          <div class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        {:else if evaluations.length === 0}
          <div class="text-center py-8 text-gray-500">
            No evaluations found. {#if user?.is_admin || user?.is_coach}Try creating one!{/if}
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engineer
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coach
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Evaluated Month
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cases
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each evaluations as evaluation}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">
                        {evaluation.engineer_name || getEngineerName(evaluation.engineer_id)}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">
                        {evaluation.coach_name || getCoachName(evaluation.coach_user_id)}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">
                        {evaluation.lead_name || 'N/A'}
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        on:click={() => viewEvaluation(evaluation.id)}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Create Evaluation Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Create New Evaluation</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Engineer *
          </label>
          <SearchableSelect
            options={availableEngineers.map(eng => ({ value: eng.id, label: eng.name }))}
            bind:value={newEvaluation.engineer_id}
            placeholder="Select an engineer..."
            searchPlaceholder="Search engineers..."
            on:change={(e) => newEvaluation.engineer_id = e.detail.value}
          />
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="evaluation-month" class="block text-sm font-medium text-gray-700 mb-1">
              Month *
            </label>
            <select
              id="evaluation-month"
              bind:value={newEvaluation.evaluation_month}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {#each monthOptions as month}
                <option value={month.value}>{month.label}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="evaluation-year" class="block text-sm font-medium text-gray-700 mb-1">
              Year *
            </label>
            <select
              id="evaluation-year"
              bind:value={newEvaluation.evaluation_year}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {#each yearOptions as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button
            on:click={() => showCreateModal = false}
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

<!-- Excel Import Modal -->
<ExcelImportModal
  bind:show={showImportModal}
  {user}
  on:close={() => showImportModal = false}
  on:success={handleImportSuccess}
/>

<style>
  /* Custom styles if needed */
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors;
  }
  
  .text-primary-600 {
    color: #2563eb;
  }
  
  .text-primary-700 {
    color: #1d4ed8;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md;
  }
</style> 