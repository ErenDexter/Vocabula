<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import * as sfx from "../lib/game/sfx";
  import { getSettings, setSettings } from "../lib/game/journal";

  let sound = false;

  onMount(() => {
    sound = getSettings().sound;
    sfx.setEnabled(sound);
  });

  function toggleSound() {
    sound = !sound;
    setSettings({ sound });
    // Called from a click, so the audio context is allowed to start here.
    sfx.setEnabled(sound);
    if (sound) sfx.tick();
  }

  $: onHome = $page.url.pathname === "/";
</script>

<header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-2">
  <div class="flex items-center gap-3">
    <a href="/" class="flex select-none no-underline" aria-label="Vocabula home">
      <span class="text-3xl">Vocabul</span>
      <span class="text-3xl" class:animate-bounce={onHome}>a</span>
    </a>

    <nav class="flex flex-wrap items-center gap-1">
      <a
        href="/daily"
        class="paper-btn btn-small btn-outline no-underline"
        class:btn-secondary={$page.url.pathname === "/daily"}>Daily</a
      >
      <a
        href="/lexicon"
        class="paper-btn btn-small btn-outline no-underline"
        class:btn-secondary={$page.url.pathname === "/lexicon"}>Lexicon</a
      >
      <a
        href="https://github.com/ErenDexter/Vocabula"
        target="_blank"
        rel="noreferrer"
        class="paper-btn btn-small btn-outline inline-flex items-center no-underline"
        title="Source on GitHub"
        aria-label="Source on GitHub"
      >
        <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
      </a>
      <button
        type="button"
        class="btn-small btn-outline"
        on:click={toggleSound}
        aria-pressed={sound}
        title={sound ? "Sound on" : "Sound off"}
      >
        {sound ? "🔊" : "🔇"}
      </button>
    </nav>
  </div>

  <p class="ml-auto text-xs text-gray-500">
    Made with 💙 by
    <a href="https://www.linkedin.com/in/rdprangon/">Prangon</a>
  </p>
</header>
