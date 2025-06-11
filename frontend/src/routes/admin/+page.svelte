<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authStore } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import apiService from "$lib/api";
  import { clickOutside } from "$lib/actions/clickOutside";
  import type { User, ManagerAssignment } from "$lib/types";

  // Component for the 3-dot menu
  import ActionMenu from "./components/ActionMenu.svelte";

  let currentUser: User | null = null;
  let users: User[] = [];
  let isLoading = true;
  let error = "";
  let successMessage = "";
  let showDeleteUserModal = false;
  let selectedUser: User | null = null;
  let showAssignManagerModal = false;
  let selectedManager: User | null = null;
  let showRemoveManagerModal = false;
  let deleteConfirmText = "";
  // Change password modal state
  let showChangePasswordModal = false;
  let newPassword = "";
  let confirmPassword = "";
  let searchTerm = "";
  let managerAssignments: ManagerAssignment[] = [];
  let isLoadingAssignments = false;

  onMount(() => {
    const unsubscribe = authStore.subscribe(async (auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto("/login");
      } else if (auth.isAuthenticated) {
        currentUser = auth.user;

        if (!currentUser?.is_admin && !currentUser?.is_manager) {
          goto("/dashboard");
          return;
        }

        await loadUsers();
      }
    });

    return () => unsubscribe();
  });

  async function handleLogout() {
    await authStore.logout();
    goto("/login");
  }

  async function loadUsers() {
    try {
      isLoading = true;
      const [usersResponse, assignmentsResponse] = await Promise.all([
        apiService.getAllUsers(),
        apiService.getAllManagerAssignments(),
      ]);

      users = usersResponse.users;
      managerAssignments = assignmentsResponse.assignments;

      // Enhance users with their manager information
      users = users.map((user) => {
        // Find if this user is assigned to a manager
        // Handle both field names (user_id from API and assigned_to from interface)
        const assignment = managerAssignments.find(
          (a) =>
            (a.user_id === user.id || a.assigned_to === user.id) &&
            !a.deleted_at,
        );

        if (assignment) {
          // User has a manager assigned
          return {
            ...user,
            has_manager: true,
            manager_id: assignment.manager_id,
            manager_name: assignment.manager_name,
          };
        }

        return user;
      });

      // Mark users who have someone managing them
      users.forEach((user) => {
        // Check if current user is managing any other users
        if (currentUser && user.manager_id === currentUser.id) {
          user.managed_by_current_user = true;
        }
      });
    } catch (err: any) {
      error = err.response?.data?.error || "Failed to load users";
    } finally {
      isLoading = false;
    }
  }

  async function updateUserRoles(
    userId: number,
    roles: {
      is_coach?: boolean;
      is_lead?: boolean;
      is_admin?: boolean;
      is_manager?: boolean;
    },
  ) {
    try {
      error = "";
      successMessage = "";

      const response = await apiService.updateUserRoles(userId, roles);

      // Update the user in the local list
      users = users.map((user) => (user.id === userId ? response.user : user));

      successMessage = response.message;

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = "";
      }, 3000);
    } catch (err: any) {
      error = err.response?.data?.error || "Failed to update user roles";
    }
  }

  function getUserRoles(user: User | null | undefined): string[] {
    if (!user) return ["User"];

    const roles: string[] = [];
    if (user.is_admin) roles.push("Admin");
    if (user.is_manager) roles.push("Manager");
    if (user.is_lead) roles.push("Lead");
    if (user.is_coach) roles.push("Coach");
    return roles.length > 0 ? roles : ["User"];
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function openDeleteUserModal(user: User) {
    selectedUser = user;
    deleteConfirmText = "";
    showDeleteUserModal = true;
  }

  async function deleteUser() {
    try {
      if (deleteConfirmText !== "DELETE") {
        toastStore.add({
          type: "warning",
          message: 'Please type "DELETE" to confirm',
        });
        return;
      }

      if (!selectedUser) return;

      // Soft delete the user
      await apiService.deleteUser(selectedUser.id);

      showDeleteUserModal = false;
      toastStore.add({ type: "success", message: "User deleted successfully" });
      await loadUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to delete user";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Function to open the assign manager modal
  function openAssignManagerModal(user: User) {
    selectedUser = user;
    showAssignManagerModal = true;
  }

  // Function to open the remove manager modal
  function openRemoveManagerModal(user: User) {
    selectedUser = user;
    showRemoveManagerModal = true;
  }

  // Function to remove a manager from a user
  async function removeManager() {
    if (!selectedUser) return;

    try {
      // Find the manager assignment
      const assignment = managerAssignments.find(
        (a) => a.assigned_to === selectedUser?.id && !a.deleted_at,
      );

      if (!assignment) {
        toastStore.add({
          type: "error",
          message: "No manager assignment found",
        });
        return;
      }

      // Call the API to remove manager from user
      await apiService.removeManagerFromUser(
        assignment.manager_id,
        selectedUser.id,
      );

      toastStore.add({
        type: "success",
        message: `Removed manager from ${selectedUser.name}`,
      });

      showRemoveManagerModal = false;

      // Reload users to reflect changes
      await loadUsers();
    } catch (error: any) {
      console.error("Error removing manager:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to remove manager";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Function to assign a manager to a user
  async function assignManager() {
    if (!selectedUser || !selectedManager) return;

    try {
      // Call the API to assign manager to user
      await apiService.assignManagerToUser(selectedManager.id, selectedUser.id);

      toastStore.add({
        type: "success",
        message: `Assigned ${selectedManager.name} as manager to ${selectedUser.name}`,
      });

      showAssignManagerModal = false;
      selectedManager = null;

      // Reload users to reflect changes
      await loadUsers();
    } catch (error: any) {
      console.error("Error assigning manager:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to assign manager";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Function to become a manager for a user
  async function becomeManagerFor(user: User) {
    if (!currentUser) return;

    try {
      // Call the API to assign current user as manager
      await apiService.assignManagerToUser(currentUser.id, user.id);

      toastStore.add({
        type: "success",
        message: `You are now the manager for ${user.name}`,
      });

      // Reload users to reflect changes
      await loadUsers();
    } catch (error: any) {
      console.error("Error becoming manager:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to become manager";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Function to stop being a manager for a user
  async function stopBeingManagerFor(user: User) {
    if (!currentUser) return;

    try {
      // Call the API to remove current user as manager
      await apiService.removeManagerFromUser(currentUser.id, user.id);

      toastStore.add({
        type: "success",
        message: `You are no longer the manager for ${user.name}`,
      });

      // Reload users to reflect changes
      await loadUsers();
    } catch (error: any) {
      console.error("Error removing manager assignment:", error);
      toastStore.add({
        type: "error",
        message:
          error.response?.data?.error || "Failed to remove manager assignment",
      });
    }
  }

  // Function to open change password modal
  function openChangePasswordModal(user: User) {
    selectedUser = user;
    newPassword = "";
    confirmPassword = "";
    showChangePasswordModal = true;
  }

  // Function to change user's password
  async function changePassword() {
    if (!selectedUser) return;
    if (newPassword !== confirmPassword) {
      toastStore.add({ type: "error", message: "Passwords do not match" });
      return;
    }
    try {
      await apiService.changeUserPassword(selectedUser.id, newPassword);
      toastStore.add({
        type: "success",
        message: "Password changed successfully",
      });
      showChangePasswordModal = false;
      newPassword = "";
      confirmPassword = "";
    } catch (err: any) {
      console.error("Error changing password:", err);
      const errorMessage =
        err.response?.data?.error || "Failed to change password";
      toastStore.add({ type: "error", message: errorMessage });
    }
  }

  // Filtered users based on search
  $: filteredUsers = users.filter(
    (user) =>
      !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );
</script>

<svelte:head>
  <title>User Management - KCS Portal</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- removed local nav header; using global Header -->

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="px-4 py-6 sm:px-0">
      <!-- User Management Header -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">User Management</h2>
          <p class="text-gray-600">Manage user roles and permissions</p>
        </div>
        {#if currentUser?.is_admin}
          <a href="/admin/db-management" class="btn-primary">
            Database Management
          </a>
        {/if}
      </div>

      <!-- Search Filter -->
      <div class="card mb-6">
        <div class="px-6 py-4">
          <div class="flex justify-between items-center">
            <div class="flex-1 max-w-md">
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Search Users</label
              >
              <input
                type="text"
                bind:value={searchTerm}
                placeholder="Search by name or email..."
                class="input"
              />
            </div>
            <span class="text-sm text-gray-500">
              {filteredUsers.length} of {users.length} users
            </span>
          </div>
        </div>
      </div>

      <!-- Messages -->
      {#if error}
        <div
          class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
        >
          {error}
        </div>
      {/if}

      {#if successMessage}
        <div
          class="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded"
        >
          {successMessage}
        </div>
      {/if}

      <!-- Users Table -->
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"
            ></div>
            <p class="mt-2 text-gray-600">Loading users...</p>
          </div>
        </div>
      {:else}
        <div class="card overflow-visible mb-8 min-h-[600px]">
          <div class="overflow-visible">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    User
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Roles
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Manager
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredUsers as user (user.id)}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div class="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex space-x-1">
                        {#each getUserRoles(user) as role}
                          <span class="badge badge-{role.toLowerCase()}"
                            >{role}</span
                          >
                        {/each}
                      </div>
                    </td>
                    <!-- Manager column -->
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {#if user.manager_name}
                        {user.manager_name}
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {formatDate(user.created_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <ActionMenu
                        {user}
                        {currentUser}
                        on:makeCoach={() =>
                          updateUserRoles(user.id, {
                            is_coach: !user.is_coach,
                          })}
                        on:makeLead={() =>
                          updateUserRoles(user.id, { is_lead: !user.is_lead })}
                        on:makeAdmin={() =>
                          updateUserRoles(user.id, {
                            is_admin: !user.is_admin,
                          })}
                        on:makeManager={() =>
                          updateUserRoles(user.id, {
                            is_manager: !user.is_manager,
                          })}
                        on:deleteUser={() => openDeleteUserModal(user)}
                        on:assignManager={() => openAssignManagerModal(user)}
                        on:becomeManager={() => becomeManagerFor(user)}
                        on:stopBeingManager={() => stopBeingManagerFor(user)}
                        on:changePassword={() => openChangePasswordModal(user)}
                      />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div class="card p-4">
            <div class="text-2xl font-bold text-gray-900">{users.length}</div>
            <div class="text-sm text-gray-500">Total Users</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-purple-600">
              {users.filter((u) => u.is_admin).length}
            </div>
            <div class="text-sm text-gray-500">Admins</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-blue-600">
              {users.filter((u) => u.is_lead).length}
            </div>
            <div class="text-sm text-gray-500">Leads</div>
          </div>
          <div class="card p-4">
            <div class="text-2xl font-bold text-green-600">
              {users.filter((u) => u.is_coach).length}
            </div>
            <div class="text-sm text-gray-500">Coaches</div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Delete User Modal -->
{#if showDeleteUserModal && selectedUser}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <h3 class="text-lg font-medium text-red-900 mb-4">
          Delete User: {selectedUser.name}
        </h3>

        <div class="mb-4">
          <p class="text-sm text-gray-700 mb-4">
            This will permanently delete the user ({selectedUser.email}). The
            user will no longer be able to access the system and will be removed
            from all lists.
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
            on:click={() => (showDeleteUserModal = false)}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            on:click={deleteUser}
            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            disabled={deleteConfirmText !== "DELETE"}
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Assign Manager Modal -->
{#if showAssignManagerModal && selectedUser}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          Assign Manager to {selectedUser.name}
        </h3>

        <div class="mb-4">
          <p class="text-sm text-gray-700 mb-4">
            Select a manager to assign to this lead.
          </p>

          <div class="mb-4">
            <label
              for="managerSelect"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Select Manager</label
            >
            <select
              id="managerSelect"
              class="input w-full"
              bind:value={selectedManager}
            >
              <option value={null}>-- Select a Manager --</option>
              {#each users.filter((u) => u.is_manager && selectedUser && u.id !== selectedUser.id) as manager}
                <option value={manager}>{manager.name} ({manager.email})</option
                >
              {/each}
            </select>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            type="button"
            on:click={() => (showAssignManagerModal = false)}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            on:click={assignManager}
            class="btn-primary"
            disabled={!selectedManager}
          >
            Assign Manager
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Remove Manager Modal -->
{#if showRemoveManagerModal && selectedUser}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <h3 class="text-lg font-medium text-red-900 mb-4">
          Remove Manager from {selectedUser.name}
        </h3>

        <div class="mb-4">
          <p class="text-sm text-gray-700 mb-4">
            Are you sure you want to remove the manager assignment for this
            user?
            {#if selectedUser.manager_name}
              Current manager: <span class="font-medium"
                >{selectedUser.manager_name}</span
              >
            {/if}
          </p>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            type="button"
            on:click={() => (showRemoveManagerModal = false)}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            on:click={removeManager}
            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Remove Manager
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Change Password Modal -->
{#if showChangePasswordModal && selectedUser}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          Change Password: {selectedUser.name}
        </h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            bind:value={newPassword}
            class="input w-full"
          />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            bind:value={confirmPassword}
            class="input w-full"
          />
        </div>
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            on:click={() => (showChangePasswordModal = false)}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={changePassword}
            class="btn-primary"
            disabled={!newPassword || newPassword !== confirmPassword}
          >
            Change Password
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
