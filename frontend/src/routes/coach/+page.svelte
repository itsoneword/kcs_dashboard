<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import apiService from '$lib/api';
  import SearchableSelect from '$lib/components/SearchableSelect.svelte';
  import type { User, Evaluation, Engineer, CreateEvaluationRequest } from '$lib/types';

  let user: User | null = null;
  let isLoading = true;
  let evaluations: Evaluation[] = [];
  let engineers: Engineer[] = [];
  let coaches: User[] = [];
  let leads: User[] = [];
  let showCreateModal = false;
  let selectedFilters = {
    engineer_id: '',
    coach_user_id: '',
    lead_user_id: '',
    year: new Date().getFullYear().toString(),
    month: ''
  };

  // Create evaluation form
  let newEvaluation: CreateEvaluationRequest = {
    engineer_id: 0,
    evaluation_date: new Date().toISOString().split('T')[0]
  };

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        user = auth.user;
        if (!user?.is_coach && !user?.is_lead && !user?.is_admin) {
          goto('/dashboard');
        } else {
          loadData();
        }
      }
    });

    return unsubscribe;
  });

  async function loadData() {
    try {
      isLoading = true;
      
      // Load evaluations, engineers, and users in parallel
      const [evaluationsResponse, engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEvaluations(getFilters()),
        apiService.getEngineersForEvaluation(),
        apiService.getAllUsers()
      ]);

      evaluations = evaluationsResponse.evaluations;
      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter(u => u.is_coach);
      leads = usersResponse.users.filter(u => u.is_lead || u.is_admin);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      isLoading = false;
    }
  }

  function getFilters() {
    const filters: any = {};
    if (selectedFilters.engineer_id) filters.engineer_id = parseInt(selectedFilters.engineer_id);
    if (selectedFilters.coach_user_id) filters.coach_user_id = parseInt(selectedFilters.coach_user_id);
    if (selectedFilters.lead_user_id) filters.lead_user_id = parseInt(selectedFilters.lead_user_id);
    if (selectedFilters.year) filters.year = parseInt(selectedFilters.year);
    if (selectedFilters.month) filters.month = parseInt(selectedFilters.month);
    return filters;
  }

  async function applyFilters() {
    try {
      isLoading = true;
      const response = await apiService.getAllEvaluations(getFilters());
      evaluations = response.evaluations;
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      isLoading = false;
    }
  }

  async function createEvaluation() {
    try {
      if (!newEvaluation.engineer_id || !newEvaluation.evaluation_date) {
        alert('Please fill in all required fields');
        return;
      }

      await apiService.createEvaluation(newEvaluation);
      showCreateModal = false;
      
      // Reset form
      newEvaluation = {
        engineer_id: 0,
        evaluation_date: new Date().toISOString().split('T')[0]
      };
      
      // Reload evaluations
      await loadData();
    } catch (error: any) {
      console.error('Error creating evaluation:', error);
      alert(error.response?.data?.error || 'Failed to create evaluation');
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function getQuarter(dateString: string): string {
    const month = new Date(dateString).getMonth() + 1;
    return `Q${Math.ceil(month / 3)}`;
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Coach Evaluations - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading evaluations...</p>
    </div>
  </div>
{:else if user}
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
            <h1 class="text-xl font-semibold text-gray-900">Coach Evaluations</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-700">Welcome, {user.name}</span>
            <span class="badge badge-coach">Coach</span>
            <button on:click={handleLogout} class="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        
        <!-- Header with Create Button -->
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Evaluations</h2>
            <p class="text-gray-600">Manage and create engineer evaluations</p>
          </div>
          <button 
            on:click={() => showCreateModal = true}
            class="btn-primary"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Evaluation
          </button>
        </div>

        <!-- Filters -->
        <div class="card p-4 mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Filters</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Engineer</label>
              <SearchableSelect
                bind:value={selectedFilters.engineer_id}
                options={engineers.map(e => ({ id: e.id, name: e.name }))}
                placeholder="Select Engineer..."
                emptyText="All Engineers"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Coach</label>
              <SearchableSelect
                bind:value={selectedFilters.coach_user_id}
                options={coaches.map(c => ({ id: c.id, name: c.name }))}
                placeholder="Select Coach..."
                emptyText="All Coaches"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Team Lead</label>
              <SearchableSelect
                bind:value={selectedFilters.lead_user_id}
                options={leads.map(l => ({ id: l.id, name: l.name }))}
                placeholder="Select Lead..."
                emptyText="All Leads"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select bind:value={selectedFilters.year} class="input">
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2025">2025</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select bind:value={selectedFilters.month} class="input">
                <option value="">All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
            <div class="flex items-end">
              <button on:click={applyFilters} class="btn-secondary w-full">Apply Filters</button>
            </div>
          </div>
        </div>

        <!-- Evaluations List -->
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Recent Evaluations</h3>
          </div>
          
          {#if evaluations.length === 0}
            <div class="p-6 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No evaluations</h3>
              <p class="mt-1 text-sm text-gray-500">Get started by creating a new evaluation.</p>
              <div class="mt-6">
                <button on:click={() => showCreateModal = true} class="btn-primary">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Evaluation
                </button>
              </div>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engineer</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coach</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quarter</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cases</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each evaluations as evaluation}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{evaluation.engineer_name}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">{evaluation.coach_name}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">{evaluation.lead_name || 'N/A'}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">{formatDate(evaluation.evaluation_date)}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getQuarter(evaluation.evaluation_date)}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">{evaluation.case_count || 0} cases</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-500">{formatDate(evaluation.created_at)}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a href="/coach/evaluations/{evaluation.id}" class="text-primary-600 hover:text-primary-900 mr-4">
                          Edit
                        </a>
                        <a href="/reports/engineer/{evaluation.engineer_id}" class="text-gray-600 hover:text-gray-900">
                          View Stats
                        </a>
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
          
          <form on:submit|preventDefault={createEvaluation}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Engineer</label>
              <select bind:value={newEvaluation.engineer_id} required class="input">
                <option value={0}>Select Engineer</option>
                {#each engineers as engineer}
                  <option value={engineer.id}>{engineer.name}</option>
                {/each}
              </select>
            </div>
            
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Evaluation Date</label>
              <input 
                type="date" 
                bind:value={newEvaluation.evaluation_date} 
                required 
                class="input"
              />
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button" 
                on:click={() => showCreateModal = false}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                Create Evaluation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
{/if} 