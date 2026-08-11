<script>
  import "../app.pcss";
  import "papercss/dist/paper.css";
  import Header from "../components/Header.svelte";
</script>

<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    <slot />
  </main>
</div>
