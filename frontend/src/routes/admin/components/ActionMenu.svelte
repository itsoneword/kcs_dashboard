<script lang="ts">
  // @ts-nocheck
  import { createEventDispatcher } from "svelte";
  import { clickOutside } from "$lib/actions/clickOutside";
  import type { User } from "$lib/types";

  export let user: User;
  export let currentUser: User | null;

  const dispatch = createEventDispatcher();

  let isOpen = false;

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function closeMenu() {
    isOpen = false;
  }

  // Check if current user is admin
  $: isAdmin = currentUser?.is_admin || false;

  // Check if current user is manager
  $: isManager = currentUser?.is_manager || false;

  // Check if the user is the current user
  $: isSelf = user.id === currentUser?.id;
</script>

<div
  class="relative inline-block text-left overflow-visible"
  use:clickOutside
  on:outclick={closeMenu}
>
  <button
    class="p-1 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none"
    on:click={toggleMenu}
    aria-label="User actions"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  </button>

  {#if isOpen}
    <div
      class="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="menu-button"
    >
      <div class="py-1" role="none">
        <!-- Common actions for both Admin and Manager -->
        <button
          class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
          role="menuitem"
          on:click={() => {
            dispatch("makeCoach");
            closeMenu();
          }}
        >
          {user.is_coach ? "Remove Coach Role" : "Assign Coach Role"}
        </button>

        <button
          class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
          role="menuitem"
          on:click={() => {
            dispatch("makeLead");
            closeMenu();
          }}
        >
          {user.is_lead ? "Remove Lead Role" : "Assign Lead Role"}
        </button>

        {#if user.is_lead}
          <button
            class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            role="menuitem"
            on:click={() => {
              dispatch("assignManager");
              closeMenu();
            }}
          >
            Assign Manager
          </button>

          {#if isManager || isAdmin}
            {#if user.managed_by_current_user}
              <button
                class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                role="menuitem"
                on:click={() => {
                  dispatch("stopBeingManager");
                  closeMenu();
                }}
              >
                Stop Being Manager For
              </button>
            {:else}
              <button
                class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                role="menuitem"
                on:click={() => {
                  dispatch("becomeManager");
                  closeMenu();
                }}
              >
                Become Manager For
              </button>
            {/if}
          {/if}
        {/if}

        <!-- Admin-only actions -->
        {#if isAdmin}
          <hr class="my-1 border-gray-200" />

          <!-- Change Password action for admins -->
          <button
            class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            role="menuitem"
            on:click={() => {
              dispatch("changePassword");
              closeMenu();
            }}
          >
            Change Password
          </button>

          {#if !isSelf}
            <button
              class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              role="menuitem"
              on:click={() => {
                dispatch("makeAdmin");
                closeMenu();
              }}
            >
              {user.is_admin ? "Remove Admin Role" : "Assign Admin Role"}
            </button>

            <button
              class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              role="menuitem"
              on:click={() => {
                dispatch("makeManager");
                closeMenu();
              }}
            >
              {user.is_manager ? "Remove Manager Role" : "Assign Manager Role"}
            </button>
          {/if}

          {#if !isSelf}
            <button
              class="text-red-600 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              role="menuitem"
              on:click={() => {
                dispatch("deleteUser");
                closeMenu();
              }}
            >
              Delete User
            </button>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
