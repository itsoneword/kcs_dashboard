<script lang="ts">
  import MultiSelectSearchable from '$lib/components/MultiSelectSearchable.svelte';
  import { createEventDispatcher, setContext } from 'svelte';
  import { writable } from 'svelte/store';

  export let engineers: { value: any; label: string }[] = [];
  export let coaches: { value: any; label: string }[] = [];
  export let leads: { value: any; label: string }[] = [];
  export let years: { value: any; label: string }[] = [];
  export let months: { value: any; label: string }[] = [];

  export let selectedEngineers: any[] = [];
  export let selectedCoaches: any[] = [];
  export let selectedLeads: any[] = [];
  export let selectedYears: any[] = [];
  export let selectedMonths: any[] = [];

  const dispatch = createEventDispatcher();
  const openDropdown = writable<string | null>(null);
  setContext('dropdownGroup', { openDropdown });

  function emitChange() {
    dispatch('change', {
      engineers: selectedEngineers,
      coaches: selectedCoaches,
      leads: selectedLeads,
      years: selectedYears,
      months: selectedMonths
    });
  }

  // $: emitChange(); // Emit on any change

  function clearFilters() {
    selectedEngineers = [];
    selectedCoaches = [];
    selectedLeads = [];
    selectedYears = [];
    selectedMonths = [];
    emitChange();
  }
</script>

<div class="container mx-auto px-4 bg-white rounded-lg shadow-md p-6 mb-6">
  <h2 class="text-lg font-semibold mb-4">Filters</h2>
  <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Engineer</label>
      <MultiSelectSearchable
        group="engineer"
        options={engineers}
        bind:values={selectedEngineers}
        placeholder="All Engineers"
        searchPlaceholder="Search engineers..."
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Coach</label>
      <MultiSelectSearchable
        group="coach"
        options={coaches}
        bind:values={selectedCoaches}
        placeholder="All Coaches"
        searchPlaceholder="Search coaches..."
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Lead</label>
      <MultiSelectSearchable
        group="lead"
        options={leads}
        bind:values={selectedLeads}
        placeholder="All Leads"
        searchPlaceholder="Search leads..."
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
      <MultiSelectSearchable
        group="year"
        options={years}
        bind:values={selectedYears}
        placeholder="All Years"
        searchPlaceholder="Search years..."
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
      <MultiSelectSearchable
        group="month"
        options={months}
        bind:values={selectedMonths}
        placeholder="All Months"
        searchPlaceholder="Search months..."
      />
    </div>
  </div>
  <div class="flex gap-2 mt-4">
    <button
      on:click={emitChange}
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Apply Filters
    </button>
    <button
      on:click={clearFilters}
      class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
    >
      Clear Filters
    </button>
  </div>
</div>
