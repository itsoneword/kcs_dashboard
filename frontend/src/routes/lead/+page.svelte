<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';
  import apiService from '$lib/api';
  import type { User, Engineer, CoachAssignment, CreateEngineerRequest, CreateAssignmentRequest } from '$lib/types';

  let user: User | null = null;
  let isLoading = true;
  let engineers: Engineer[] = [];
  let assignments: CoachAssignment[] = [];
  let coaches: User[] = [];
  let leads: User[] = [];
  let showCreateEngineerModal = false;
  let showAssignCoachModal = false;
  let showAssignLeadModal = false;
  let showDeleteEngineerModal = false;
  let showReactivateEngineerModal = false;
  let selectedEngineer: Engineer | null = null;
  
  // Filtering
  let searchTerm = '';
  let showOnlyMyTeam = false;
  let hideInactiveEngineers = true;
  
  // Delete confirmation
  let deleteConfirmText = '';
  
  // Assign lead form
  let newLeadAssignment = {
    engineer_id: 0,
    lead_user_id: 0
  };

  // Create engineer form
  let newEngineer: CreateEngineerRequest = {
    name: '',
    lead_user_id: undefined
  };

  // Assign coach form
  let newAssignment: CreateAssignmentRequest = {
    engineer_id: 0,
    coach_user_id: 0,
    start_date: new Date().toISOString().split('T')[0]
  };

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        user = auth.user;
        // Allow access for admin, lead, or coach users
        if (!user?.is_lead && !user?.is_admin && !user?.is_coach) {
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
      
      // Load engineers, assignments, and coaches in parallel
      const [engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEngineers(),
        apiService.getAllUsers()
      ]);

      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter(u => u.is_coach);
      leads = usersResponse.users.filter(u => u.is_lead || u.is_admin); // Include admins in leads list

      // Load assignments for each engineer
      const assignmentPromises = engineers.map(engineer => 
        apiService.getEngineerAssignments(engineer.id)
      );
      const assignmentResponses = await Promise.all(assignmentPromises);
      assignments = assignmentResponses.flatMap(response => response.assignments);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function createEngineer() {
    try {
      if (!newEngineer.name.trim()) {
        toastStore.add({ type: 'warning', message: 'Please enter engineer name' });
        return;
      }

      await apiService.createEngineer(newEngineer);
      showCreateEngineerModal = false;
      
      // Reset form with appropriate default
      newEngineer = { 
        name: '', 
        lead_user_id: user?.is_lead && !user?.is_admin ? user.id : undefined 
      };
      
      toastStore.add({ type: 'success', message: 'Engineer created successfully' });
      
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error creating engineer:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create engineer';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  async function assignCoach() {
    try {
      if (!newAssignment.engineer_id || !newAssignment.coach_user_id) {
        toastStore.add({ type: 'warning', message: 'Please select both engineer and coach' });
        return;
      }

      await apiService.createCoachAssignment(newAssignment);
      showAssignCoachModal = false;
      
      // Reset form
      newAssignment = {
        engineer_id: 0,
        coach_user_id: 0,
        start_date: new Date().toISOString().split('T')[0]
      };
      
      toastStore.add({ type: 'success', message: 'Coach assigned successfully' });
      
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error assigning coach:', error);
      const errorMessage = error.response?.data?.error || 'Failed to assign coach';
      
      if (error.response?.status === 403) {
        toastStore.add({ 
          type: 'error', 
          message: 'Access denied: You can only assign coaches to engineers that report to you',
          duration: 7000
        });
      } else {
        toastStore.add({ type: 'error', message: errorMessage });
      }
    }
  }

  async function endAssignment(assignmentId: number) {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      await apiService.endCoachAssignment(assignmentId, endDate);
      toastStore.add({ type: 'success', message: 'Coach assignment ended successfully' });
      await loadData();
    } catch (error: any) {
      console.error('Error ending assignment:', error);
      const errorMessage = error.response?.data?.error || 'Failed to end assignment';
      
      if (error.response?.status === 403) {
        toastStore.add({ 
          type: 'error', 
          message: 'Access denied: You can only manage assignments for engineers that report to you',
          duration: 7000
        });
      } else {
        toastStore.add({ type: 'error', message: errorMessage });
      }
    }
  }

  function openAssignCoachModal(engineer: Engineer) {
    selectedEngineer = engineer;
    newAssignment.engineer_id = engineer.id;
    showAssignCoachModal = true;
  }

  function openAssignLeadModal(engineer: Engineer) {
    selectedEngineer = engineer;
    newLeadAssignment.engineer_id = engineer.id;
    newLeadAssignment.lead_user_id = engineer.lead_user_id || 0;
    showAssignLeadModal = true;
  }

  function openDeleteEngineerModal(engineer: Engineer) {
    selectedEngineer = engineer;
    deleteConfirmText = '';
    showDeleteEngineerModal = true;
  }

  function openReactivateEngineerModal(engineer: Engineer) {
    selectedEngineer = engineer;
    showReactivateEngineerModal = true;
  }

  async function assignLead() {
    try {
      if (!newLeadAssignment.engineer_id || !newLeadAssignment.lead_user_id) {
        toastStore.add({ type: 'warning', message: 'Please select a lead' });
        return;
      }

      await apiService.updateEngineer(newLeadAssignment.engineer_id, {
        lead_user_id: newLeadAssignment.lead_user_id
      });
      
      showAssignLeadModal = false;
      toastStore.add({ type: 'success', message: 'Lead assigned successfully' });
      await loadData();
    } catch (error: any) {
      console.error('Error assigning lead:', error);
      const errorMessage = error.response?.data?.error || 'Failed to assign lead';
      
      if (error.response?.status === 403) {
        toastStore.add({ 
          type: 'error', 
          message: 'Access denied: You can only modify engineers that report to you',
          duration: 7000
        });
      } else {
        toastStore.add({ type: 'error', message: errorMessage });
      }
    }
  }

  async function deleteEngineer() {
    try {
      if (deleteConfirmText !== 'DELETE') {
        toastStore.add({ type: 'warning', message: 'Please type "DELETE" to confirm' });
        return;
      }

      if (!selectedEngineer) return;

      // For now, we'll deactivate instead of hard delete
      await apiService.updateEngineer(selectedEngineer.id, { is_active: false });
      
      showDeleteEngineerModal = false;
      toastStore.add({ type: 'success', message: 'Engineer deactivated successfully' });
      await loadData();
    } catch (error: any) {
      console.error('Error deleting engineer:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete engineer';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  async function reactivateEngineer() {
    try {
      if (!selectedEngineer) return;

      await apiService.updateEngineer(selectedEngineer.id, { is_active: true });
      
      showReactivateEngineerModal = false;
      toastStore.add({ type: 'success', message: 'Engineer reactivated successfully' });
      await loadData();
    } catch (error: any) {
      console.error('Error reactivating engineer:', error);
      const errorMessage = error.response?.data?.error || 'Failed to reactivate engineer';
      toastStore.add({ type: 'error', message: errorMessage });
    }
  }

  // Filtered engineers based on search and team filter
  $: filteredEngineers = engineers.filter(engineer => {
    // Search filter
    const matchesSearch = !searchTerm || 
      engineer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      engineer.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getActiveAssignment(engineer.id)?.coach_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Team filter
    const matchesTeam = !showOnlyMyTeam || 
      !user?.is_lead || 
      user.is_admin || 
      engineer.lead_user_id === user.id;
    
    // Active filter
    const matchesActive = !hideInactiveEngineers || engineer.is_active;
    
    return matchesSearch && matchesTeam && matchesActive;
  });

  function getEngineerAssignments(engineerId: number): CoachAssignment[] {
    return assignments.filter(a => a.engineer_id === engineerId);
  }

  function getActiveAssignment(engineerId: number): CoachAssignment | null {
    return assignments.find(a => a.engineer_id === engineerId && a.is_active) || null;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Team Management - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading team data...</p>
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
            <h1 class="text-xl font-semibold text-gray-900">Team Management</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-700">Welcome, {user.name}</span>
            {#if user.is_admin}
              <span class="badge badge-admin">Admin</span>
            {:else if user.is_lead}
              <span class="badge badge-lead">Lead</span>
            {:else if user.is_coach}
              <span class="badge badge-coach">Coach</span>
            {/if}
            <button on:click={handleLogout} class="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        
        <!-- Header with Actions -->
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Team Management</h2>
            <p class="text-gray-600">Manage engineers and coach assignments</p>
          </div>
          <div class="flex space-x-3">
            <button 
              on:click={() => {
                // Reset form and set default lead for non-admin users
                newEngineer = { 
                  name: '', 
                  lead_user_id: user?.is_lead && !user?.is_admin ? user.id : undefined 
                };
                showCreateEngineerModal = true;
              }}
              class="btn-secondary"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Engineer
            </button>
            <a href="/reports" class="btn-primary">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Reports
            </a>
          </div>
        </div>

        <!-- Filters -->
        <div class="card mb-6">
          <div class="px-6 py-4">
            <div class="flex flex-col sm:flex-row gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Search Engineers</label>
                <input 
                  type="text" 
                  bind:value={searchTerm}
                  placeholder="Search by name, lead, or coach..."
                  class="input"
                />
              </div>
              <div class="flex flex-col sm:flex-row gap-4 sm:items-end">
                {#if user?.is_lead && !user?.is_admin}
                  <label class="flex items-center">
                    <input 
                      type="checkbox" 
                      bind:checked={showOnlyMyTeam}
                      class="mr-2"
                    />
                    <span class="text-sm text-gray-700">Show only my team</span>
                  </label>
                {/if}
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={hideInactiveEngineers}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Hide inactive engineers</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Engineers List -->
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-medium text-gray-900">Engineers</h3>
              <span class="text-sm text-gray-500">
                {filteredEngineers.length} of {engineers.length} engineers
              </span>
            </div>
          </div>
          
          {#if filteredEngineers.length === 0 && engineers.length === 0}
            <div class="p-6 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No engineers</h3>
              <p class="mt-1 text-sm text-gray-500">Get started by adding an engineer to your team.</p>
              <div class="mt-6">
                <button on:click={() => {
                  newEngineer = { 
                    name: '', 
                    lead_user_id: user?.is_lead && !user?.is_admin ? user.id : undefined 
                  };
                  showCreateEngineerModal = true;
                }} class="btn-primary">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Engineer
                </button>
              </div>
            </div>
          {:else if filteredEngineers.length === 0}
            <div class="p-6 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No engineers found</h3>
              <p class="mt-1 text-sm text-gray-500">Try adjusting your search or filters.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Coach</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment Date</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each filteredEngineers as engineer}
                    {@const activeAssignment = getActiveAssignment(engineer.id)}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{engineer.name}</div>
                        <div class="text-sm text-gray-500">ID: {engineer.id}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if engineer.lead_name}
                          <div class="text-sm text-gray-900">{engineer.lead_name}</div>
                        {:else}
                          <span class="text-sm text-gray-500">No lead assigned</span>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {engineer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                          {engineer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if activeAssignment}
                          <div class="text-sm text-gray-900">{activeAssignment.coach_name}</div>
                        {:else}
                          <span class="text-sm text-gray-500">No coach assigned</span>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if activeAssignment}
                          <div class="text-sm text-gray-500">{formatDate(activeAssignment.start_date)}</div>
                        {:else}
                          <span class="text-sm text-gray-500">-</span>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex flex-col space-y-1">
                          <div class="flex space-x-2">
                            {#if activeAssignment}
                              <button 
                                on:click={() => endAssignment(activeAssignment.id)}
                                class="text-red-600 hover:text-red-900"
                              >
                                End Assignment
                              </button>
                            {:else}
                              <button 
                                on:click={() => openAssignCoachModal(engineer)}
                                class="text-primary-600 hover:text-primary-900"
                              >
                                Assign Coach
                              </button>
                            {/if}
                            {#if user?.is_admin}
                              <button 
                                on:click={() => openAssignLeadModal(engineer)}
                                class="text-blue-600 hover:text-blue-900"
                              >
                                Change Lead
                              </button>
                            {/if}
                          </div>
                          <div class="flex space-x-2">
                            <a href="/reports/engineer/{engineer.id}" class="text-gray-600 hover:text-gray-900">
                              View Stats
                            </a>
                            {#if user?.is_admin}
                              {#if engineer.is_active}
                                <button 
                                  on:click={() => openDeleteEngineerModal(engineer)}
                                  class="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              {:else}
                                <button 
                                  on:click={() => openReactivateEngineerModal(engineer)}
                                  class="text-green-600 hover:text-green-900"
                                >
                                  Reactivate
                                </button>
                              {/if}
                            {/if}
                          </div>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Quick Stats -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="card p-4">
            <div class="text-2xl font-bold text-primary-600">{engineers.length}</div>
            <div class="text-sm text-gray-500">Total Engineers</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-green-600">{engineers.filter(e => e.is_active).length}</div>
            <div class="text-sm text-gray-500">Active Engineers</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-blue-600">{assignments.filter(a => a.is_active).length}</div>
            <div class="text-sm text-gray-500">Active Assignments</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-purple-600">{coaches.length}</div>
            <div class="text-sm text-gray-500">Available Coaches</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Engineer Modal -->
  {#if showCreateEngineerModal}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Add New Engineer</h3>
          
          <form on:submit|preventDefault={createEngineer}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Engineer Name</label>
              <input 
                type="text" 
                bind:value={newEngineer.name} 
                required 
                class="input"
                placeholder="Enter engineer name"
              />
            </div>
            
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Lead</label>
              {#if user?.is_admin}
                <select bind:value={newEngineer.lead_user_id} class="input">
                  <option value={undefined}>Select Lead (Optional)</option>
                  {#each leads as lead}
                    <option value={lead.id}>{lead.name}</option>
                  {/each}
                </select>
              {:else if user?.is_lead}
                <select bind:value={newEngineer.lead_user_id} class="input">
                  <option value={user.id} selected>{user.name} (You)</option>
                  {#each leads.filter(l => l.id !== user.id) as lead}
                    <option value={lead.id}>{lead.name}</option>
                  {/each}
                </select>
              {:else}
                <input type="text" value="Not applicable" disabled class="input opacity-50" />
              {/if}
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button" 
                on:click={() => showCreateEngineerModal = false}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                Add Engineer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Assign Coach Modal -->
  {#if showAssignCoachModal && selectedEngineer}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Assign Coach to {selectedEngineer.name}</h3>
          
          <form on:submit|preventDefault={assignCoach}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Coach</label>
              <select bind:value={newAssignment.coach_user_id} required class="input">
                <option value={0}>Select Coach</option>
                {#each coaches as coach}
                  <option value={coach.id}>{coach.name}</option>
                {/each}
              </select>
            </div>
            
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input 
                type="date" 
                bind:value={newAssignment.start_date} 
                required 
                class="input"
              />
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button" 
                on:click={() => showAssignCoachModal = false}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                Assign Coach
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Assign Lead Modal -->
  {#if showAssignLeadModal && selectedEngineer}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Change Lead for {selectedEngineer.name}</h3>
          
          <form on:submit|preventDefault={assignLead}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Lead</label>
              <select bind:value={newLeadAssignment.lead_user_id} required class="input">
                <option value={0}>Select Lead</option>
                {#each leads as lead}
                  <option value={lead.id}>{lead.name}</option>
                {/each}
              </select>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button" 
                on:click={() => showAssignLeadModal = false}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                Assign Lead
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Engineer Modal -->
  {#if showDeleteEngineerModal && selectedEngineer}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-red-900 mb-4">Delete Engineer: {selectedEngineer.name}</h3>
          
          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-4">
              This will deactivate the engineer and remove them from active lists. 
              This action cannot be undone.
            </p>
            <p class="text-sm font-medium text-gray-900 mb-2">
              Type <span class="font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input 
              type="text" 
              bind:value={deleteConfirmText}
              placeholder="Type DELETE to confirm"
              class="input"
            />
          </div>
          
          <div class="flex justify-end space-x-3">
            <button 
              type="button" 
              on:click={() => showDeleteEngineerModal = false}
              class="btn-secondary"
            >
              Cancel
            </button>
            <button 
              on:click={deleteEngineer}
              class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              disabled={deleteConfirmText !== 'DELETE'}
            >
              Delete Engineer
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Reactivate Engineer Modal -->
  {#if showReactivateEngineerModal && selectedEngineer}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-green-900 mb-4">Reactivate Engineer: {selectedEngineer.name}</h3>
          
          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-4">
              This will reactivate the engineer and make them available for assignments and evaluations again.
            </p>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button 
              type="button" 
              on:click={() => showReactivateEngineerModal = false}
              class="btn-secondary"
            >
              Cancel
            </button>
            <button 
              on:click={reactivateEngineer}
              class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Reactivate Engineer
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if} 