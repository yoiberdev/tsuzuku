<script lang="ts">
  import Estados from '../componentes/Estados.svelte'
  import Icono from '../componentes/Icono.svelte'
  import Tarjeta from '../componentes/Tarjeta.svelte'
  import { ErrorAniList, temporada } from '../lib/anilist'
  import { ajustes } from '../lib/estado.svelte'
  import { genero, moverTemporada, temporadaDe, temporadaMeses, temporadaNombre, titulo } from '../lib/formato'
  import type { Tarjeta as TipoTarjeta } from '../lib/tipos'

  const actual = temporadaDe()
  let t = $state(actual)
  let items = $state.raw<TipoTarjeta[]>([])
  let pagina = $state(1)
  let hayMas = $state(false)
  let cargando = $state(true)
  let error = $state('')
  let grupo = $state<'todo' | 'series' | 'peliculas' | 'otros'>('series')
  let orden = $state<'popular' | 'nota' | 'nombre'>('popular')
  let filtroGenero = $state('')

  const GRUPOS = { todo: null, series: ['TV', 'TV_SHORT'], peliculas: ['MOVIE'], otros: ['ONA', 'OVA', 'SPECIAL'] } as const

  async function cargar(season: string, year: number, page: number) {
    cargando = true
    error = ''
    try {
      const r = await temporada(season, year, page)
      if (season !== t.season || year !== t.year) return
      items = page === 1 ? r.Page.media : [...items, ...r.Page.media.filter((m) => !items.some((x) => x.id === m.id))]
      hayMas = r.Page.pageInfo.hasNextPage
    } catch (e) {
      error = (e as ErrorAniList).message
    } finally {
      cargando = false
    }
  }

  $effect(() => {
    items = []
    pagina = 1
    cargar(t.season, t.year, 1)
  })

  function mas() {
    pagina++
    cargar(t.season, t.year, pagina)
  }

  const generos = $derived([...new Set(items.flatMap((m) => m.genres))].sort((a, b) => genero(a).localeCompare(genero(b))))

  const visibles = $derived.by(() => {
    const formatos = GRUPOS[grupo] as readonly string[] | null
    const lista = items.filter((m) => (!formatos || formatos.includes(m.format ?? '')) && (!filtroGenero || m.genres.includes(filtroGenero)))
    if (orden === 'nota') return [...lista].sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
    if (orden === 'nombre') return [...lista].sort((a, b) => titulo(a.title, ajustes.idioma).localeCompare(titulo(b.title, ajustes.idioma)))
    return lista
  })

  const esActual = $derived(t.season === actual.season && t.year === actual.year)
</script>

<div class="contenido">
  <header class="cabecera">
    <div>
      <h1>Temporada</h1>
      <span class="bajada">Lo que se estrena cada tres meses en Japón</span>
    </div>
    <span class="kana">今期アニメ</span>
  </header>

  <div class="selector">
    <button class="redondo" onclick={() => (t = moverTemporada(t, -1))} aria-label="Temporada anterior"><Icono nombre="izquierda" /></button>
    <div class="cual">
      <b>{temporadaNombre(t.season)} {t.year}</b>
      <span>{temporadaMeses(t.season)}{esActual ? ' · la de ahora' : ''}</span>
    </div>
    <button class="redondo" onclick={() => (t = moverTemporada(t, 1))} aria-label="Temporada siguiente"><Icono nombre="derecha" /></button>
  </div>
  {#if !esActual}
    <p class="volver"><button class="enlace" onclick={() => (t = actual)}>Volver a la de ahora</button></p>
  {/if}

  <div class="chips" role="radiogroup" aria-label="Formato">
    {#each [['series', 'Series'], ['peliculas', 'Películas'], ['otros', 'ONA, OVA y especiales'], ['todo', 'Todo']] as [id, nombre] (id)}
      <button class="chip" role="radio" aria-checked={grupo === id} onclick={() => (grupo = id as typeof grupo)}>{nombre}</button>
    {/each}
  </div>
  <div class="filtros">
    <label>
      <span>Ordenar</span>
      <select bind:value={orden}>
        <option value="popular">Más populares</option>
        <option value="nota">Mejor nota</option>
        <option value="nombre">Por nombre</option>
      </select>
    </label>
    <label>
      <span>Género</span>
      <select bind:value={filtroGenero}>
        <option value="">Todos</option>
        {#each generos as g (g)}<option value={g}>{genero(g)}</option>{/each}
      </select>
    </label>
  </div>

  {#if items.length}
    {#if visibles.length}
      <div class="rejilla">
        {#each visibles as m (m.id)}
          <Tarjeta anime={m} />
        {/each}
      </div>
    {:else}
      <p class="nada">Nada con esos filtros{hayMas ? ' entre los que van cargados' : ''}.</p>
    {/if}
    {#if hayMas || (cargando && pagina > 1)}
      <div class="mas">
        <button class="boton" onclick={mas} disabled={cargando}>{cargando ? 'Cargando…' : 'Cargar más'}</button>
      </div>
    {/if}
  {/if}
  {#if error && items.length}
    <Estados {error} reintentar={() => cargar(t.season, t.year, pagina)} />
  {:else if !items.length}
    <Estados {cargando} {error} reintentar={() => cargar(t.season, t.year, 1)} />
    {#if !cargando && !error}<p class="nada">AniList todavía no tiene animes para esta temporada.</p>{/if}
  {/if}
</div>

<style>
  .selector {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    margin: 8px 0 6px;
  }

  .cual {
    display: grid;
    justify-items: center;
    text-align: center;
  }

  .cual b {
    font-family: var(--titulo);
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
  }

  .cual span {
    font-size: 13px;
    color: var(--tinta-2);
  }

  .volver {
    text-align: center;
    margin-bottom: 6px;
    font-size: 14px;
  }

  .filtros {
    display: flex;
    gap: 12px;
    margin: 4px 0 14px;
  }

  .filtros label {
    flex: 1;
    display: grid;
    gap: 3px;
    max-width: 240px;
  }

  .filtros span {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tinta-2);
  }

  .filtros select {
    height: 40px;
    padding: 0 10px;
    border: 2px solid var(--linea);
    background: var(--papel);
    border-radius: 0;
    font-weight: 600;
  }

  .nada {
    padding: 24px 0;
    color: var(--tinta-3);
  }
</style>
