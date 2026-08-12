<script lang="ts">
  // Rendered twice — top-right in the header on desktop, as a page footer on
  // mobile — so the href and wording only live in one place.
  let extra = "";
  export { extra as class };
</script>

<p class="text-xs text-gray-500 {extra}">
  Made with 💙 by
  <!-- Two lines where it sits beside the nav, one where it sits under the page. -->
  <br class="hidden sm:inline" />
  <a href="https://github.com/ErenDexter" class="bg-none font-semibold">Ranat Das Prangon</a>
</p>
