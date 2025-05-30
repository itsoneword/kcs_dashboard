<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';

  onMount(() => {
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isLoading) {
        if (auth.isAuthenticated) {
          goto('/dashboard');
        } else {
          goto('/login');
        }
      }
    });

    return unsubscribe;
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="text-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
    <p class="mt-4 text-gray-600">Loading KCS Portal...</p>
  </div>
</div>
