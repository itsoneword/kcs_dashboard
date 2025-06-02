<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let options: { value: any; label: string }[] = [];
  export let value: any = null;
  export let placeholder = "Select an option...";
  export let searchPlaceholder = "Search...";
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let searchTerm = "";
  let selectedOption: { value: any; label: string } | null = null;

  // Find selected option when value changes
  $: {
    selectedOption = options.find((opt) => opt.value === value) || null;
  }

  // Filter options based on search term
  $: filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  function selectOption(option: { value: any; label: string }) {
    value = option.value;
    selectedOption = option;
    isOpen = false;
    searchTerm = "";
    dispatch("change", { value: option.value, option });
  }

  function toggleDropdown() {
    if (!disabled) {
      isOpen = !isOpen;
      if (isOpen) {
        searchTerm = "";
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      isOpen = false;
      searchTerm = "";
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative">
  <!-- Selected value display -->
  <button
    type="button"
    class="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {disabled
      ? 'bg-gray-100 cursor-not-allowed'
      : 'cursor-pointer hover:border-gray-400'}"
    on:click={toggleDropdown}
    {disabled}
  >
    <span class="block truncate">
      {selectedOption ? selectedOption.label : placeholder}
    </span>
    <span
      class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
    >
      <svg
        class="w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        ></path>
      </svg>
    </span>
  </button>

  <!-- Dropdown -->
  {#if isOpen}
    <div
      class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg"
    >
      <!-- Search input -->
      <div class="p-2 border-b border-gray-200">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={searchPlaceholder}
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          on:click|stopPropagation
        />
      </div>

      <!-- Options list -->
      <div class="max-h-60 overflow-auto">
        {#each filteredOptions as option}
          <button
            type="button"
            class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none {value ===
            option.value
              ? 'bg-blue-100 text-blue-900'
              : 'text-gray-900'}"
            on:click={() => selectOption(option)}
          >
            {option.label}
          </button>
        {:else}
          <div class="px-3 py-2 text-sm text-gray-500">No options found</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
  <div
    class="fixed inset-0 z-0"
    on:click={() => {
      isOpen = false;
      searchTerm = "";
    }}
  ></div>
{/if}
