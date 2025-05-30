<script lang="ts">
  import { toastStore, type Toast } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';

  let toasts: Toast[] = [];

  toastStore.subscribe(value => {
    toasts = value;
  });

  function getToastClasses(type: Toast['type']): string {
    const baseClasses = 'flex items-center p-4 mb-4 text-sm rounded-lg shadow-lg';
    
    switch (type) {
      case 'success':
        return `${baseClasses} text-green-800 bg-green-50 border border-green-200`;
      case 'error':
        return `${baseClasses} text-red-800 bg-red-50 border border-red-200`;
      case 'warning':
        return `${baseClasses} text-yellow-800 bg-yellow-50 border border-yellow-200`;
      case 'info':
        return `${baseClasses} text-blue-800 bg-blue-50 border border-blue-200`;
      default:
        return `${baseClasses} text-gray-800 bg-gray-50 border border-gray-200`;
    }
  }

  function getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  }
</script>

<!-- Toast Container -->
<div class="fixed top-4 right-4 z-50 space-y-2">
  {#each toasts as toast (toast.id)}
    <div
      class={getToastClasses(toast.type)}
      transition:fly={{ x: 300, duration: 300 }}
    >
      <span class="mr-2 font-bold">{getIcon(toast.type)}</span>
      <span class="flex-1">{toast.message}</span>
      <button
        on:click={() => toastStore.remove(toast.id)}
        class="ml-2 text-gray-400 hover:text-gray-600"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  {/each}
</div> 