<script lang="ts">
  import Estados from '../componentes/Estados.svelte'
  import Icono from '../componentes/Icono.svelte'
  import Tarjeta from '../componentes/Tarjeta.svelte'
  import { buscar, ErrorAniList } from '../lib/anilist'
  import { pestaña, ruta } from '../lib/estado.svelte'
  import { GENEROS } from '../lib/formato'
  import type { Tarjeta as TipoTarjeta } from '../lib/tipos'

  let escrito = $state('')
  let texto = $state('')
  let items = $state.raw<TipoTarjeta[]>([])
  let pagina = $state(1)
  let hayMas = $state(false)
  let cargando = $state(true)
  let error = $state('')

  const genero = $derived(ruta.genero)

  // Se busca cuando dejas de escribir un momento, para no gastar consultas letra por letra.
  $effect(() => {
    const t = escrito.trim()
    const id = setTimeout(() => (texto = t), t ? 450 : 0)
    return () => clearTimeout(id)
  })

  async function cargar(t: string, g: string, page: number) {
    cargando = true
    error = ''
    try {
      const r = await buscar({ texto: t, genero: g, page })
      if (t !== texto || g !== genero) return
      items = page === 1 ? r.Page.media : [...items, ...r.Page.media.filter((m) => !items.some((x) => x.id === m.id))]
      hayMas = r.Page.pageInfo.hasNextPage
    } catch (e) {
      error = (e as ErrorAniList).message
    } finally {
      cargando = false
    }
  }

  $effect(() => {
    pagina = 1
    cargar(texto, genero, 1)
  })

  function mas() {
    pagina++
    cargar(texto, genero, pagina)
  }

  const titulo = $derived(texto ? `Resultados para «${texto}»` : genero ? `Lo más popular de ${GENEROS[genero]?.toLowerCase() ?? genero}` : 'Lo que más se está viendo')
</script>

<div class="contenido">
  <header class="cabecera">
    <h1>Buscar</h1>
    <span class="kana">検索</span>
  </header>

  <form class="campo" role="search" onsubmit={(e) => (e.preventDefault(), (texto = escrito.trim()))}>
    <Icono nombre="buscar" />
    <input type="search" bind:value={escrito} placeholder="Frieren, One Piece, Chainsaw Man…" aria-label="Nombre del anime" autocomplete="off" enterkeyhint="search" />
    {#if escrito}
      <button type="button" class="borrar" onclick={() => (escrito = '')} aria-label="Borrar"><Icono nombre="cerrar" /></button>
    {/if}
  </form>

  <div class="chips" role="radiogroup" aria-label="Género">
    <button class="chip" role="radio" aria-checked={!genero} onclick={() => pestaña('buscar')}>Todos</button>
    {#each Object.entries(GENEROS) as [id, nombre] (id)}
      <button class="chip" role="radio" aria-checked={genero === id} onclick={() => pestaña('buscar', genero === id ? '' : id)}>{nombre}</button>
    {/each}
  </div>

  <h2 class="titulo-seccion">{titulo}</h2>

  {#if items.length}
    <div class="rejilla">
      {#each items as m (m.id)}
        <Tarjeta anime={m} />
      {/each}
    </div>
    {#if hayMas}
      <div class="mas">
        <button class="boton" onclick={mas} disabled={cargando}>{cargando ? 'Cargando…' : 'Cargar más'}</button>
      </div>
    {/if}
  {/if}
  {#if error || !items.length}
    <Estados cargando={cargando && !items.length} {error} reintentar={() => cargar(texto, genero, pagina)} />
    {#if !cargando && !error && !items.length}
      <p class="nada">No hay nada con ese nombre. Prueba con el título en japonés o en inglés.</p>
    {/if}
  {/if}
</div>

<style>
  .campo {
    position: sticky;
    top: -8px;
    z-index: 5;
    display: grid;
    grid-template-columns: 26px 1fr auto;
    align-items: center;
    gap: 10px;
    margin: 4px 0 10px;
    padding: 0 12px;
    height: 54px;
    border: 2px solid var(--linea);
    background: var(--papel);
    box-shadow: 4px 4px 0 var(--sombra);
  }

  .campo :global(svg) {
    width: 24px;
    height: 24px;
  }

  .campo input {
    height: 100%;
    border: 0;
    background: none;
    outline: none;
    font-size: 17px;
    font-weight: 600;
    min-width: 0;
  }

  .campo input::-webkit-search-cancel-button {
    display: none;
  }

  .borrar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
  }

  .titulo-seccion {
    margin-top: 14px;
  }

  .nada {
    padding: 24px 0;
    color: var(--tinta-3);
  }
</style>
