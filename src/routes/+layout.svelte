<script>
  // Order matters: Tailwind's preflight has to land before PaperCSS (otherwise it
  // strips heading sizes, link colours and list styling), and our own fixes have
  // to land after it.
  import "../app.pcss";
  import "papercss/dist/paper.css";
  import "../paper-overrides.css";
  import Header from "../components/Header.svelte";
  import Credit from "../components/Credit.svelte";
</script>

<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    <slot />
  </main>
  <!-- Header shows this at top-right from `sm` up; on narrow screens it lands
       here instead, pushed to the bottom by `main`'s flex-1. -->
  <Credit class="px-5 pb-4 pt-8 text-center sm:hidden" />
</div>
