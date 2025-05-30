<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import Toast from '$lib/components/Toast.svelte';
  import '../app.css';

  onMount(() => {
    // Initialize auth state from localStorage
    authStore.init();
  });
</script>

<main class="min-h-screen">
  <slot />
</main>

<!-- Global Toast Notifications -->
<Toast /> 