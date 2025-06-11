<script lang="ts">
  export const ssr = false;
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import Toast from '$lib/components/Toast.svelte';
  import Header from '$lib/components/Header.svelte';
  import '../app.css';
  import { page } from '$app/stores';
  import type { User } from '$lib/types';

  let user: User | null = null;
  let title = '';

  onMount(() => {
    authStore.init();
  });

  authStore.subscribe((auth) => {
    user = auth.user;
  });

  $: title = getTitle($page.url.pathname);

  function getTitle(path: string): string {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    let seg = segments[segments.length - 1];
    if (!isNaN(Number(seg))) {
      seg = segments[segments.length - 2];
    }
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <Header {title} {user} showBackButton={title !== 'Dashboard'} />
  <main class="container mx-auto px-4 py-8">
    <slot />
  </main>
</div>

<!-- Global Toast Notifications -->
<Toast />