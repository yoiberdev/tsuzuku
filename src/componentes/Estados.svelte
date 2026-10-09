<script lang="ts">
  // Lo que se ve mientras carga una cuadrícula, o si AniList falla.
  let { cargando = false, error = '', n = 12, reintentar }: { cargando?: boolean; error?: string; n?: number; reintentar?: () => void } = $props()
</script>

{#if error}
  <div class="error" role="alert">
    <p>{error}</p>
    {#if reintentar}<button class="boton" onclick={reintentar}>Reintentar</button>{/if}
  </div>
{:else if cargando}
  <div class="rejilla" aria-busy="true" aria-label="Cargando">
    {#each { length: n } as _, i (i)}
      <div class="tarjeta esqueleto" aria-hidden="true">
        <div class="cubierta"></div>
        <div class="nombre"></div>
      </div>
    {/each}
  </div>
{/if}
