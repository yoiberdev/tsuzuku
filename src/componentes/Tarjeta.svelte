<script lang="ts">
  import { abrirAnime, ajustes } from '../lib/estado.svelte'
  import { falta, formato, nombreEstado, titulo } from '../lib/formato'
  import { entrada } from '../lib/lista.svelte'
  import type { Tarjeta } from '../lib/tipos'

  let { anime, etiqueta = '', proximo = true, ahora = Date.now() }: { anime: Tarjeta; etiqueta?: string; proximo?: boolean; ahora?: number } = $props()

  const mia = $derived(entrada(anime.id))
  const datos = $derived(
    etiqueta ||
      [anime.studios?.nodes[0]?.name, formato(anime.format), anime.episodes ? `${anime.episodes} ep` : '']
        .filter(Boolean)
        .join(' · '),
  )
  const sale = $derived(proximo && anime.nextAiringEpisode ? falta(anime.nextAiringEpisode.airingAt, ahora) : '')
</script>

<a
  class="tarjeta"
  href="#/anime/{anime.id}"
  onclick={(e) => {
    e.preventDefault()
    abrirAnime(anime.id)
  }}
>
  <div class="cubierta" style:--c={anime.coverImage.color ?? undefined}>
    <img src={anime.coverImage.large} alt="" loading="lazy" decoding="async" />
    {#if anime.averageScore}
      <span class="sello" title="Nota media en AniList">{anime.averageScore}</span>
    {/if}
    {#if mia}
      <span class="cinta {mia.estado}">{nombreEstado(mia.estado)}</span>
    {/if}
  </div>
  <b class="nombre">{titulo(anime.title, ajustes.idioma)}</b>
  {#if datos}<span class="datos">{datos}</span>{/if}
  {#if sale && anime.nextAiringEpisode}
    <span class="proximo"><span>Ep {anime.nextAiringEpisode.episode} en {sale}</span></span>
  {/if}
</a>
