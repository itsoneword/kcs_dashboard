<script lang="ts">
  import { createEventDispatcher, getContext } from "svelte";
  import type { Writable } from "svelte/store";

  export let options: { value: any; label: string }[] = [];
  export let values: any[] = [];
  export let placeholder = "Select options...";
  export let searchPlaceholder = "Search...";
  export let disabled = false;
  export let group: string = "";

  const dispatch = createEventDispatcher();
  let isOpen = false;
  let searchTerm = "";

  const groupContext = getContext<{ openDropdown: Writable<string | null> }>("dropdownGroup");

  if (groupContext && group) {
    groupContext.openDropdown.subscribe((key) => {
      if (key !== group) {
        isOpen = false;
        searchTerm = "";
      }
    });
  }

  // Filter options based on search term
  $: filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function toggleDropdown() {
    if (!disabled) {
      if (!isOpen) {
        isOpen = true;
        if (groupContext && group) groupContext.openDropdown.set(group);
        searchTerm = "";
      } else {
        isOpen = false;
        if (groupContext && group) groupContext.openDropdown.set(null);
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      isOpen = false;
      searchTerm = "";
      if (groupContext && group) groupContext.openDropdown.set(null);
    }
  }

  function selectOption(option: { value: any; label: string }) {
    if (!values.includes(option.value)) {
      values = [...values, option.value];
      dispatch("change", { values });
    }
  }

  function deselectOption(option: { value: any; label: string }) {
    values = values.filter((v) => v !== option.value);
    dispatch("change", { values });
  }

  function isSelected(option: { value: any; label: string }) {
    return values.includes(option.value);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative">
  <!-- Selected values display -->
  <button
    type="button"
    class="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {disabled
      ? 'bg-gray-100 cursor-not-allowed'
      : 'cursor-pointer hover:border-gray-400'}"
    on:click={toggleDropdown}
    {disabled}
  >
    <span class="flex flex-wrap gap-1">
      {#if values.length === 0}
        <span class="text-gray-400">{placeholder}</span>
      {:else}
        {#each values as v}
          {#if options.find((opt) => opt.value === v)}
            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">
              {options.find((opt) => opt.value === v).label}
              <span class="cursor-pointer ml-1" on:click|stopPropagation={() => deselectOption(options.find((opt) => opt.value === v))}>&times;</span>
            </span>
          {/if}
        {/each}
      {/if}
    </span>
    <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </span>
  </button>

  <!-- Dropdown -->
  {#if isOpen}
    <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
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
            class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none {isSelected(option) ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}"
            on:click={() => isSelected(option) ? deselectOption(option) : selectOption(option)}
          >
            <span>{option.label}</span>
            {#if isSelected(option)}
              <span class="ml-2 text-blue-600">&#10003;</span>
            {/if}
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
      if (groupContext && group) groupContext.openDropdown.set(null);
    }}
  ></div>
{/if}
