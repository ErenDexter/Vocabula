<script lang="ts">
  export let index: number;
  export let total: number;
  export let score: number;
  /** Consecutive solves so far. */
  export let streak: number;
  export let tier: string;

  $: multiplier =
    streak >= 5 ? "×2" : streak >= 3 ? "×1.5" : streak === 2 ? "×1.2" : null;
</script>

<div class="mt-6 flex items-baseline justify-center gap-4 text-gray-500 lg:mt-2">
  <span class="tabular-nums">{index + 1}/{total}</span>

  <span class="text-xs uppercase tracking-wide">{tier}</span>

  <span class="font-bold tabular-nums text-gray-700">
    {score.toLocaleString("en-US")}
    <span class="text-xs font-normal">pts</span>
  </span>

  {#if multiplier}
    <span class="font-bold text-orange-500" title="{streak} in a row">
      🔥 {multiplier}
    </span>
  {/if}
</div>
