<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { HintKind } from "../lib/types";
  import { HINT_COSTS } from "../lib/game/scoring";

  export let hintsUsed: HintKind[];
  export let disabled = false;

  const dispatch = createEventDispatcher<{ hint: HintKind; skip: void }>();

  const TIERS: { kind: HintKind; label: string }[] = [
    { kind: "reveal", label: "Reveal a letter" },
    { kind: "hint", label: "Hint" },
    { kind: "definition", label: "Definition" },
  ];
</script>

<div class="mt-8 flex flex-wrap items-center justify-center gap-2 lg:mt-6">
  {#each TIERS as tier}
    <button
      type="button"
      class="btn-small btn-outline font-bold"
      class:disabled={disabled || hintsUsed.includes(tier.kind)}
      disabled={disabled || hintsUsed.includes(tier.kind)}
      on:click={() => dispatch("hint", tier.kind)}
    >
      {tier.label}
      <span class="text-sm font-normal text-gray-500">−{HINT_COSTS[tier.kind]}</span>
    </button>
  {/each}

  <button
    type="button"
    class="btn-small btn-outline text-gray-500"
    class:disabled={disabled}
    {disabled}
    on:click={() => dispatch("skip")}
  >
    Skip
  </button>
</div>
