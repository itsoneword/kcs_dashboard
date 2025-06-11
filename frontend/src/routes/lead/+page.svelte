<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authStore } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import apiService from "$lib/api";
  import type {
    User,
    Engineer,
    CoachAssignment,
    CreateEngineerRequest,
    CreateAssignmentRequest,
  } from "$lib/types";

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
  let searchTerm = "";
  let showOnlyMyTeam = false;
  let hideInactiveEngineers = true;

  // Global dropdown management
  let activeDropdownId: string | null = null;

  function toggleDropdown(dropdownId: string) {
    // If this dropdown is already active, close it
    if (activeDropdownId === dropdownId) {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) dropdown.classList.add("hidden");
      activeDropdownId = null;
      return;
    }

    // Close any open dropdown
    if (activeDropdownId) {
      const dropdown = document.getElementById(activeDropdownId);
      if (dropdown) dropdown.classList.add("hidden");
    }

    // Open the new dropdown
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) dropdown.classList.remove("hidden");
    activeDropdownId = dropdownId;
  }

  function closeAllDropdowns() {
    if (activeDropdownId) {
      const dropdown = document.getElementById(activeDropdownId);
      if (dropdown) dropdown.classList.add("hidden");
      activeDropdownId = null;
    }
  }

  // Assign lead form
  let newLeadAssignment = {
    engineer_id: 0,
    lead_user_id: 0,
  };

  // Search term for filtering leads in Assign Lead modal
  let leadSearchTerm = "";

  // Reactive filtered list of leads based on search term
  $: filteredLeads = leads.filter((lead) =>
    lead.name.toLowerCase().includes(leadSearchTerm.toLowerCase()),
  );

  // Create engineer form
  let newEngineer: CreateEngineerRequest = {
    name: "",
    lead_user_id: undefined,
  };

  // Assign coach form
  let newAssignment: CreateAssignmentRequest = {
    engineer_id: 0,
    coach_user_id: 0,
    start_date: new Date().toISOString().split("T")[0],
  };

  // Delete confirmation
  let deleteConfirmText = "";

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto("/login");
      } else if (auth.isAuthenticated) {
        user = auth.user;
        // Allow access for admin, manager, lead, or coach users
        if (
          !user?.is_lead &&
          !user?.is_admin &&
          !user?.is_coach &&
          !user?.is_manager
        ) {
          goto("/dashboard");
        } else {
          loadData();
        }
      }
    });

    // Add document click handler to close dropdowns when clicking outside
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking inside a dropdown or on a dropdown toggle button
      if (
        target.closest(".dropdown-menu") ||
        target.closest(".dropdown-toggle")
      ) {
        return;
      }
      closeAllDropdowns();
    });

    return () => {
      unsubscribe();
      document.removeEventListener("click", closeAllDropdowns);
    };
  });

  async function loadData() {
    try {
      isLoading = true;

      // Load engineers, assignments, and coaches in parallel
      const [engineersResponse, usersResponse] = await Promise.all([
        apiService.getAllEngineers(),
        apiService.getAllUsers(),
      ]);

      engineers = engineersResponse.engineers;
      coaches = usersResponse.users.filter((u) => u.is_coach);
      leads = usersResponse.users.filter(
        (u) => u.is_lead || u.is_admin || u.is_manager,
      ); // Include admins and managers in leads list

      // Load assignments for each engineer
      const assignmentPromises = engineers.map((engineer) =>
        apiService.getEngineerAssignments(engineer.id),
      );
      const assignmentResponses = await Promise.all(assignmentPromises);
      assignments = assignmentResponses.flatMap(
        (response) => response.assignments,
      );
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      isLoading = false;
    }
  }

  async function createEngineer() {
    try {
      if (!newEngineer.name.trim()) {
        toastStore.add({
          type: "warning",
          message: "Please enter engineer name",
        });
        return;
      }

      await apiService.createEngineer(newEngineer);
      showCreateEngineerModal = false;

      // Reset form with appropriate default
      newEngineer = {
        name: "",
        lead_user_id: user?.is_lead && !user?.is_admin ? user.id : undefined,
      };

      toastStore.add({
        type: "success",
        message: "Engineer created successfully",
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error("Error creating engineer:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to create engineer";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  async function assignCoach() {
    try {
      if (!newAssignment.engineer_id || !newAssignment.coach_user_id) {
        toastStore.add({
          type: "warning",
          message: "Please select both engineer and coach",
        });
        return;
      }

      await apiService.createCoachAssignment(newAssignment);
      showAssignCoachModal = false;

      // Reset form
      newAssignment = {
        engineer_id: 0,
        coach_user_id: 0,
        start_date: new Date().toISOString().split("T")[0],
      };

      toastStore.add({
        type: "success",
        message: "Coach assigned successfully",
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error("Error assigning coach:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to assign coach";

      if (error.response?.status === 403) {
        toastStore.add({
          type: "error",
          message:
            "Access denied: You can only assign coaches to engineers that report to you",
          duration: 7000,
        });
      } else {
        toastStore.add({ type: "error", message: errorMessage });
      }
    }
  }

  async function endAssignment(assignmentId: number) {
    try {
      const endDate = new Date().toISOString().split("T")[0];
      await apiService.endCoachAssignment(assignmentId, endDate);
      toastStore.add({
        type: "success",
        message: "Coach assignment ended successfully",
      });
      await loadData();
    } catch (error: any) {
      console.error("Error ending assignment:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to end assignment";

      if (error.response?.status === 403) {
        toastStore.add({
          type: "error",
          message:
            "Access denied: You can only manage assignments for engineers that report to you",
          duration: 7000,
        });
      } else {
        toastStore.add({ type: "error", message: errorMessage });
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
    deleteConfirmText = "";
    showDeleteEngineerModal = true;
  }

  function openReactivateEngineerModal(engineer: Engineer) {
    selectedEngineer = engineer;
    showReactivateEngineerModal = true;
  }

  async function assignLead() {
    try {
      if (!newLeadAssignment.engineer_id || !newLeadAssignment.lead_user_id) {
        toastStore.add({ type: "warning", message: "Please select a lead" });
        return;
      }

      await apiService.updateEngineer(newLeadAssignment.engineer_id, {
        lead_user_id: newLeadAssignment.lead_user_id,
      });

      showAssignLeadModal = false;
      toastStore.add({
        type: "success",
        message: "Lead assigned successfully",
      });
      await loadData();
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to assign lead";

      if (error.response?.status === 403) {
        toastStore.add({
          type: "error",
          message:
            "Access denied: You can only modify engineers that report to you",
          duration: 7000,
        });
      } else {
        toastStore.add({ type: "error", message: errorMessage });
      }
    }
  }

  async function deleteEngineer() {
    try {
      if (deleteConfirmText !== "DELETE") {
        toastStore.add({
          type: "warning",
          message: 'Please type "DELETE" to confirm',
        });
        return;
      }

      if (!selectedEngineer) return;

      // For now, we'll deactivate instead of hard delete
      await apiService.updateEngineer(selectedEngineer.id, {
        is_active: false,
      });

      showDeleteEngineerModal = false;
      toastStore.add({
        type: "success",
        message: "Engineer deactivated successfully",
      });
      await loadData();
    } catch (error: any) {
      console.error("Error deleting engineer:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to delete engineer";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  async function reactivateEngineer() {
    try {
      if (!selectedEngineer) return;

      await apiService.updateEngineer(selectedEngineer.id, { is_active: true });

      showReactivateEngineerModal = false;
      toastStore.add({
        type: "success",
        message: "Engineer reactivated successfully",
      });
      await loadData();
    } catch (error: any) {
      console.error("Error reactivating engineer:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to reactivate engineer";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Filtered engineers based on search and team filter
  $: filteredEngineers = engineers.filter((engineer) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      engineer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      engineer.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getActiveAssignment(engineer.id)
        ?.coach_name?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    // Team filter
    const matchesTeam =
      !showOnlyMyTeam ||
      !user?.is_lead ||
      user.is_admin ||
      user.is_manager ||
      engineer.lead_user_id === user.id;

    // Active filter
    const matchesActive = !hideInactiveEngineers || engineer.is_active;

    return matchesSearch && matchesTeam && matchesActive;
  });

  function getEngineerAssignments(engineerId: number): CoachAssignment[] {
    return assignments.filter((a) => a.engineer_id === engineerId);
  }

  function getActiveAssignment(engineerId: number): CoachAssignment | null {
    return (
      assignments.find((a) => a.engineer_id === engineerId && a.is_active) ||
      null
    );
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  async function handleLogout() {
    await authStore.logout();
    goto("/login");
  }
</script>

<svelte:head>
  <title>Engineers - KCS Portal</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"
      ></div>
      <p class="mt-4 text-gray-600">Loading team data...</p>
    </div>
  </div>
{:else if user}
  <div class="min-h-screen bg-gray-50">
    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <!-- Header with Actions -->
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Engineers</h2>
            <p class="text-gray-600">Manage engineers and coach assignments</p>
          </div>
          <div class="flex space-x-3">
            {#if user?.is_admin || user?.is_manager}
              <button
                on:click={() => {
                  // Reset form and set default lead for non-admin users
                  newEngineer = {
                    name: "",
                    lead_user_id:
                      user?.is_lead && !user?.is_admin ? user.id : undefined,
                  };
                  showCreateEngineerModal = true;
                }}
                class="btn-primary"
              >
                <svg
                  class="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add Engineer
              </button>
            {/if}
            <a href="/reports" class="btn-primary">
              <svg
                class="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
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
                <label
                  for="search-engineers"
                  class="block text-sm font-medium text-gray-700 mb-1"
                  >Search Engineers</label
                >
                <input
                  id="search-engineers"
                  type="text"
                  bind:value={searchTerm}
                  placeholder="Search by name, lead, or coach..."
                  class="input"
                />
              </div>
              <div class="flex flex-col sm:flex-row gap-4 sm:items-end">
                {#if user?.is_lead && !user?.is_admin}
                  <div class="flex items-center">
                    <input
                      id="show-only-my-team"
                      type="checkbox"
                      bind:checked={showOnlyMyTeam}
                      class="mr-2"
                    />
                    <label for="show-only-my-team" class="text-sm text-gray-700"
                      >Show only my team</label
                    >
                  </div>
                {/if}
                <div class="flex items-center">
                  <input
                    id="hide-inactive-engineers"
                    type="checkbox"
                    bind:checked={hideInactiveEngineers}
                    class="mr-2"
                  />
                  <label
                    for="hide-inactive-engineers"
                    class="text-sm text-gray-700">Hide inactive engineers</label
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Engineers List -->
        <div class="card overflow-visible mb-8 min-h-[600px] w-full">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-medium text-gray-900">Engineers</h3>
              <div class="flex items-center">
                <span class="text-sm text-gray-500">
                  {filteredEngineers.length} of {engineers.length} engineers
                </span>
              </div>
            </div>
          </div>

          {#if filteredEngineers.length === 0 && engineers.length === 0}
            <div class="p-6 text-center">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">
                No engineers
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                Get started by adding an engineer to your team.
              </p>
            </div>
          {:else if filteredEngineers.length === 0}
            <div class="p-6 text-center">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">
                No engineers found
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                Try adjusting your search or filters.
              </p>
            </div>
          {:else}
            <div class="overflow-x-auto w-full h-[600px] overflow-visible">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >Engineer</th
                    >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >Lead</th
                    >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >Status</th
                    >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >Coach</th
                    >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >Assignment date</th
                    >
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each filteredEngineers as engineer}
                    {@const activeAssignment = getActiveAssignment(engineer.id)}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">
                          {engineer.name}
                        </div>
                        <div class="text-sm text-gray-500">
                          ID: {engineer.id}
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if engineer.lead_name}
                          <div class="text-sm text-gray-900">
                            {engineer.lead_name}
                          </div>
                        {:else}
                          <span class="text-sm text-gray-500"
                            >No lead assigned</span
                          >
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {engineer.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'}"
                        >
                          {engineer.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if activeAssignment}
                          <div class="text-sm text-gray-900">
                            {activeAssignment.coach_name}
                          </div>
                        {:else}
                          <span class="text-sm text-gray-500"
                            >No coach assigned</span
                          >
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if activeAssignment}
                          <div class="text-sm text-gray-500">
                            {formatDate(activeAssignment.start_date)}
                          </div>
                        {:else}
                          <span class="text-sm text-gray-500">-</span>
                        {/if}
                      </td>
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm font-medium overflow-visible"
                      >
                        <div
                          class="relative inline-block text-left overflow-visible"
                        >
                          {#key engineer.id}
                            {@const dropdownId = `dropdown-${engineer.id}`}

                            <div>
                              <button
                                type="button"
                                class="dropdown-toggle inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                aria-expanded="true"
                                aria-haspopup="true"
                                on:click={() => toggleDropdown(dropdownId)}
                              >
                                Actions
                                <svg
                                  class="-mr-1 ml-2 h-5 w-5"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>

                            <div
                              class="dropdown-menu hidden origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                              role="menu"
                              aria-orientation="vertical"
                              id={dropdownId}
                            >
                              <div class="py-1" role="none">
                                <!-- View Statistics Option -->
                                <a
                                  href="/reports?filter=engineer_id({engineer.id})"
                                  class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  View Statistics
                                </a>

                                <!-- Change Lead Option - For Admin, Manager, or Lead of this engineer -->
                                {#if user?.is_admin || user?.is_manager || (user?.is_lead && engineer.lead_user_id === user?.id)}
                                  <button
                                    on:click={() => {
                                      openAssignLeadModal(engineer);
                                      closeAllDropdowns();
                                    }}
                                    class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                    role="menuitem"
                                  >
                                    Change Lead
                                  </button>
                                {/if}

                                <!-- Coach Assignment Options -->
                                {#if user?.is_admin || user?.is_manager || (user?.is_lead && engineer.lead_user_id === user?.id)}
                                  {#if activeAssignment}
                                    <button
                                      on:click={() => {
                                        endAssignment(activeAssignment.id);
                                        closeAllDropdowns();
                                      }}
                                      class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      End Coach Assignment
                                    </button>
                                  {:else}
                                    <button
                                      on:click={() => {
                                        openAssignCoachModal(engineer);
                                        closeAllDropdowns();
                                      }}
                                      class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      Assign Coach
                                    </button>
                                  {/if}
                                {/if}

                                <!-- Delete/Reactivate Engineer Option - For Admin and Manager only -->
                                {#if user?.is_admin || user?.is_manager}
                                  {#if engineer.is_active}
                                    <button
                                      on:click={() => {
                                        openDeleteEngineerModal(engineer);
                                        closeAllDropdowns();
                                      }}
                                      class="text-red-600 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      Delete
                                    </button>
                                  {:else}
                                    <button
                                      on:click={() => {
                                        openReactivateEngineerModal(engineer);
                                        closeAllDropdowns();
                                      }}
                                      class="text-green-600 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      Reactivate
                                    </button>
                                  {/if}
                                {/if}
                              </div>
                            </div>
                          {/key}
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
            <div class="text-2xl font-bold text-primary-600">
              {engineers.length}
            </div>
            <div class="text-sm text-gray-500">Total Engineers</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-green-600">
              {engineers.filter((e) => e.is_active).length}
            </div>
            <div class="text-sm text-gray-500">Active Engineers</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-blue-600">
              {assignments.filter((a) => a.is_active).length}
            </div>
            <div class="text-sm text-gray-500">Active Assignments</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-purple-600">
              {coaches.length}
            </div>
            <div class="text-sm text-gray-500">Available Coaches</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Engineer Modal -->
  {#if showCreateEngineerModal}
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Add New Engineer
          </h3>

          <form on:submit|preventDefault={createEngineer}>
            <div class="mb-4">
              <label
                for="engineer-name"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Engineer Name</label
              >
              <input
                id="engineer-name"
                type="text"
                bind:value={newEngineer.name}
                required
                class="input"
                placeholder="Enter engineer name"
              />
            </div>

            <div class="mb-4">
              <label
                for="lead-select"
                class="block text-sm font-medium text-gray-700 mb-1">Lead</label
              >
              {#if user?.is_admin || user?.is_manager}
                <select
                  id="lead-select"
                  bind:value={newEngineer.lead_user_id}
                  class="input"
                >
                  <option value={undefined}>Select Lead (Optional)</option>
                  {#each leads as lead}
                    <option value={lead.id}>{lead.name}</option>
                  {/each}
                </select>
              {:else if user?.is_lead && user}
                <select
                  id="lead-select"
                  bind:value={newEngineer.lead_user_id}
                  class="input"
                >
                  <option value={user?.id} selected>{user?.name} (You)</option>
                  {#each leads.filter((l) => l.id !== user?.id) as lead}
                    <option value={lead.id}>{lead.name}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type="text"
                  value="Not applicable"
                  disabled
                  class="input opacity-50"
                />
              {/if}
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                on:click={() => (showCreateEngineerModal = false)}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary"> Add Engineer </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Assign Coach Modal -->
  {#if showAssignCoachModal && selectedEngineer}
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Assign Coach to {selectedEngineer.name}
          </h3>

          <form on:submit|preventDefault={assignCoach}>
            <div class="mb-4">
              <label
                for="coach-select"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Coach</label
              >
              <select
                id="coach-select"
                bind:value={newAssignment.coach_user_id}
                required
                class="input"
              >
                <option value={0}>Select Coach</option>
                {#each coaches as coach}
                  <option value={coach.id}>{coach.name}</option>
                {/each}
              </select>
            </div>

            <div class="mb-4">
              <label
                for="start-date"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Start Date</label
              >
              <input
                id="start-date"
                type="date"
                bind:value={newAssignment.start_date}
                required
                class="input"
              />
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                on:click={() => (showAssignCoachModal = false)}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary"> Assign Coach </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Assign Lead Modal -->
  {#if showAssignLeadModal && selectedEngineer}
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Change Lead for {selectedEngineer.name}
          </h3>

          <!-- Search filter for leads -->
          <input
            type="text"
            bind:value={leadSearchTerm}
            placeholder="Search leads..."
            class="input mb-2"
          />

          <form on:submit|preventDefault={assignLead}>
            <div class="mb-4">
              <label
                for="assign-lead-select"
                class="block text-sm font-medium text-gray-700 mb-1">Lead</label
              >
              <select
                id="assign-lead-select"
                bind:value={newLeadAssignment.lead_user_id}
                required
                class="input"
              >
                <option value={0}>Select Lead</option>
                {#each filteredLeads as lead}
                  <option value={lead.id}>{lead.name}</option>
                {/each}
              </select>
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                on:click={() => (showAssignLeadModal = false)}
                class="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn-primary"> Assign Lead </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Engineer Modal -->
  {#if showDeleteEngineerModal && selectedEngineer}
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-red-900 mb-4">
            Delete Engineer: {selectedEngineer.name}
          </h3>

          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-4">
              This will deactivate the engineer and remove them from active
              lists. This action cannot be undone.
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
              on:click={() => (showDeleteEngineerModal = false)}
              class="btn-secondary"
            >
              Cancel
            </button>
            <button
              on:click={deleteEngineer}
              class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              disabled={deleteConfirmText !== "DELETE"}
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
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-green-900 mb-4">
            Reactivate Engineer: {selectedEngineer.name}
          </h3>

          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-4">
              This will reactivate the engineer and make them available for
              assignments and evaluations again.
            </p>
          </div>

          <div class="flex justify-end space-x-3">
            <button
              type="button"
              on:click={() => (showReactivateEngineerModal = false)}
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
