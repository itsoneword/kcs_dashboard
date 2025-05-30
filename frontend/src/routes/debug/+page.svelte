<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import apiService from '$lib/api';
  import type { User } from '$lib/types';

  let user: User | null = null;
  let isAuthenticated = false;
  let storedToken: string | null = null;
  let storedUser: User | null = null;
  let apiTestResults: any = {};
  let testInProgress = false;

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      user = auth.user;
      isAuthenticated = auth.isAuthenticated;
    });

    // Get stored data
    storedToken = apiService.getStoredToken();
    storedUser = apiService.getStoredUser();

    return unsubscribe;
  });

  async function testApiEndpoints() {
    testInProgress = true;
    apiTestResults = {};

    try {
      // Test auth endpoints
      try {
        const currentUser = await apiService.getCurrentUser();
        apiTestResults.currentUser = { success: true, data: currentUser };
      } catch (error: any) {
        apiTestResults.currentUser = { success: false, error: error.message };
      }

      try {
        const users = await apiService.getAllUsers();
        apiTestResults.allUsers = { success: true, count: users.users.length };
      } catch (error: any) {
        apiTestResults.allUsers = { success: false, error: error.message };
      }

      try {
        const engineers = await apiService.getAllEngineers();
        apiTestResults.engineers = { success: true, count: engineers.engineers.length };
      } catch (error: any) {
        apiTestResults.engineers = { success: false, error: error.message };
      }

      try {
        const evaluations = await apiService.getAllEvaluations();
        apiTestResults.evaluations = { success: true, count: evaluations.evaluations.length };
      } catch (error: any) {
        apiTestResults.evaluations = { success: false, error: error.message };
      }

    } catch (error) {
      console.error('Test error:', error);
    } finally {
      testInProgress = false;
    }
  }

  function clearStorage() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    location.reload();
  }

  async function handleLogout() {
    await authStore.logout();
  }
</script>

<svelte:head>
  <title>Debug - KCS Portal</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 p-8">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Authentication & API Debug</h1>

    <!-- Authentication Status -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Authentication Status</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
          <p><strong>Has Token:</strong> {storedToken ? 'Yes' : 'No'}</p>
          {#if storedToken}
            <p class="text-xs text-gray-600 mt-2 break-all">Token: {storedToken.substring(0, 50)}...</p>
          {/if}
        </div>
        <div>
          {#if user}
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Is Admin:</strong> {user.is_admin ? 'Yes' : 'No'}</p>
            <p><strong>Is Lead:</strong> {user.is_lead ? 'Yes' : 'No'}</p>
            <p><strong>Is Coach:</strong> {user.is_coach ? 'Yes' : 'No'}</p>
          {:else}
            <p class="text-gray-500">No user data</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Stored Data -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Stored Data</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <h3 class="font-medium mb-2">Stored User:</h3>
          {#if storedUser}
            <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(storedUser, null, 2)}</pre>
          {:else}
            <p class="text-gray-500">No stored user</p>
          {/if}
        </div>
        <div>
          <h3 class="font-medium mb-2">Current User (from store):</h3>
          {#if user}
            <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(user, null, 2)}</pre>
          {:else}
            <p class="text-gray-500">No current user</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- API Test Results -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">API Test Results</h2>
      <div class="space-y-4">
        <button 
          on:click={testApiEndpoints} 
          disabled={testInProgress}
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {testInProgress ? 'Testing...' : 'Test API Endpoints'}
        </button>

        {#if Object.keys(apiTestResults).length > 0}
          <div class="space-y-2">
            {#each Object.entries(apiTestResults) as [endpoint, result]}
              <div class="border rounded p-3">
                <h4 class="font-medium">{endpoint}</h4>
                {#if result.success}
                  <p class="text-green-600">✓ Success</p>
                  {#if result.count !== undefined}
                    <p class="text-sm text-gray-600">Count: {result.count}</p>
                  {/if}
                  {#if result.data}
                    <pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>
                  {/if}
                {:else}
                  <p class="text-red-600">✗ Failed: {result.error}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Actions -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Actions</h2>
      <div class="space-x-4">
        <button 
          on:click={clearStorage}
          class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Clear Storage & Reload
        </button>
        <button 
          on:click={handleLogout}
          class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Logout
        </button>
        <a href="/login" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block">
          Go to Login
        </a>
        <a href="/lead" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block">
          Go to Team Management
        </a>
      </div>
    </div>
  </div>
</div> 