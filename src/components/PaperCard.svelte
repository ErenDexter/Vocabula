<script lang="ts">
  /** The bordered panel used for definitions, hints, stats, and lexicon entries. */
  export let title: string | null = null;
  /** Renders the title beside the body rather than above it. */
  export let inline = false;
  export let width = "lg:w-1/2 w-full";
</script>

<div class="flex justify-center">
  <div class="border-2 border-gray-700 bg-white px-3.5 py-3 lg:px-6 lg:py-3 {width}">
    {#if inline}
      <div class="flex items-start gap-1.5 lg:items-center">
        {#if title}
          <h4 class="shrink-0 text-lg font-bold underline underline-offset-2 lg:text-xl">
            {title}
          </h4>
        {/if}
        <slot />
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        {#if title}
          <h4 class="text-xl font-bold underline underline-offset-2 lg:text-2xl">
            {title}
          </h4>
        {/if}
        <slot />
      </div>
    {/if}
  </div>
</div>
