<script lang="ts">
  import Icono from '../componentes/Icono.svelte'
  import Tarjeta from '../componentes/Tarjeta.svelte'
  import { abrirAjustes, abrirAnime, ajustes, avisar, pestaña } from '../lib/estado.svelte'
  import { ESTADOS, cuando, emitidos, falta, horaDe, inicioDelDia, titulo } from '../lib/formato'
  import { avanzar, entradas, porVer, tope } from '../lib/lista.svelte'
  import type { Entrada, Estado } from '../lib/tipos'

  let filtro = $state<Estado>('viendo')
  let ahora = $state(Date.now())

  $effect(() => {
    const id = setInterval(() => (ahora = Date.now()), 30e3)
    return () => clearInterval(id)
  })

  const todas = $derived(entradas())
  const cuenta = $derived(Object.fromEntries(ESTADOS.map((e) => [e.id, todas.filter((x) => x.estado === e.id).length])) as Record<Estado, number>)

  // El próximo episodio que se conoce y todavía no salió.
  function siguiente(e: Entrada) {
    const s = ahora / 1000
    return e.proximos?.find((p) => p.airingAt > s) ?? (e.anime.nextAiringEpisode && e.anime.nextAiringEpisode.airingAt > s ? e.anime.nextAiringEpisode : null)
  }

  // Viendo: primero lo que tiene episodios por ver, después lo que sale antes.
  const visibles = $derived(
    todas
      .filter((e) => e.estado === filtro)
      .sort((a, b) => {
        if (filtro !== 'viendo') return b.actualizado - a.actualizado
        const pa = porVer(a)
        const pb = porVer(b)
        if (!!pa !== !!pb) return pa ? -1 : 1
        const sa = siguiente(a)?.airingAt ?? Infinity
        const sb = siguiente(b)?.airingAt ?? Infinity
        return sa - sb || b.actualizado - a.actualizado
      }),
  )

  const pendientes = $derived(todas.filter((e) => e.estado === 'viendo').reduce((n, e) => n + porVer(e), 0))
  const hoy = $derived.by(() => {
    const fin = inicioDelDia(new Date(ahora)).getTime() / 1000 + 86400
    return todas.filter((e) => e.estado === 'viendo' && (siguiente(e)?.airingAt ?? Infinity) < fin).length
  })
  const bajada = $derived(
    [pendientes ? `${pendientes} ${pendientes === 1 ? 'episodio' : 'episodios'} por ver` : '', hoy ? `${hoy} ${hoy === 1 ? 'estreno' : 'estrenos'} hoy` : '']
      .filter(Boolean)
      .join(' · ') || (todas.length ? 'Al día con todo' : ''),
  )

  // Segmentos de la barra de progreso: uno por episodio, si no son demasiados.
  function segmentos(e: Entrada) {
    const sale = emitidos(e.anime) ?? e.progreso
    const total = e.anime.episodes ?? Math.max(sale + (e.anime.nextAiringEpisode ? 1 : 0), e.progreso)
    if (!total || total > 60) return null
    return Array.from({ length: total }, (_, i) => (i < e.progreso ? 'visto' : i < sale ? 'salio' : 'falta'))
  }

  function sumar(e: Entrada) {
    const nombre = titulo(e.anime.title, ajustes.idioma)
    if (avanzar(e.id) === 'terminado') avisar(`Terminaste ${nombre}. Pasó a vistos.`)
  }
</script>

<div class="contenido">
  <header class="cabecera">
    <div>
      <h1>Mi lista</h1>
      {#if bajada}<span class="bajada">{bajada}</span>{/if}
    </div>
    <div class="cabecera-acciones">
      <button class="redondo" onclick={abrirAjustes} aria-label="Ajustes"><Icono nombre="ajustes" /></button>
      <span class="kana">マイリスト</span>
    </div>
  </header>

  {#if !todas.length}
    <div class="vacio">
      <span class="grande">つづく</span>
      <p>Todavía no sigues nada. Busca lo que estás viendo, o mira qué se está emitiendo esta temporada y agrégalo desde su ficha.</p>
      <div class="botones">
        <button class="boton primario" onclick={() => pestaña('temporada')}>Ver la temporada</button>
        <button class="boton" onclick={() => pestaña('buscar')}>Buscar un anime</button>
      </div>
      <p>¿Ya llevas tu lista en AniList? <button class="enlace" onclick={abrirAjustes}>Impórtala</button>.</p>
    </div>
  {:else}
    <div class="chips" role="radiogroup" aria-label="Estado">
      {#each ESTADOS as e (e.id)}
        <button class="chip" role="radio" aria-checked={filtro === e.id} onclick={() => (filtro = e.id)}>
          {e.nombre} <span class="n">{cuenta[e.id]}</span>
        </button>
      {/each}
    </div>

    {#if !visibles.length}
      <p class="nada">Nada por aquí.</p>
    {:else if filtro === 'viendo'}
      <div class="filas">
        {#each visibles as e (e.id)}
          {@const nuevos = porVer(e)}
          {@const sig = siguiente(e)}
          {@const seg = segmentos(e)}
          <article class="fila" class:con-nuevos={nuevos > 0}>
            <a
              class="mini"
              href="#/anime/{e.id}"
              style:--c={e.anime.coverImage.color ?? undefined}
              onclick={(ev) => {
                ev.preventDefault()
                abrirAnime(e.id)
              }}
            >
              <img src={e.anime.coverImage.large} alt="" loading="lazy" decoding="async" />
            </a>
            <div class="info">
              <a
                class="nombre"
                href="#/anime/{e.id}"
                onclick={(ev) => {
                  ev.preventDefault()
                  abrirAnime(e.id)
                }}>{titulo(e.anime.title, ajustes.idioma)}</a
              >
              {#if seg}
                <div class="barra" aria-hidden="true">
                  {#each seg as s, i (i)}<i class={s}></i>{/each}
                </div>
              {/if}
              <p class="vas">
                {#if e.progreso}Vas en el {e.progreso}{e.anime.episodes ? ` de ${e.anime.episodes}` : ''}{:else}Sin empezar{/if}
                {#if nuevos}<b class="nuevos">{nuevos} por ver</b>{/if}
              </p>
              {#if sig}
                <p class="sig"><Icono nombre="reloj" /> Ep {sig.episode} {cuando(sig.airingAt, ahora)} {horaDe(sig.airingAt)} · en {falta(sig.airingAt, ahora)}</p>
              {/if}
            </div>
            <button class="sumar" onclick={() => sumar(e)} aria-label="Marcar el episodio {e.progreso + 1} como visto" disabled={e.progreso >= tope(e.anime)}>
              +1
            </button>
          </article>
        {/each}
      </div>
    {:else}
      <div class="rejilla">
        {#each visibles as e (e.id)}
          <Tarjeta anime={e.anime} {ahora} etiqueta={e.estado === 'terminado' || !e.progreso ? '' : `Vas en el ${e.progreso}${e.anime.episodes ? ` de ${e.anime.episodes}` : ''}`} />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .nada {
    padding: 30px 0;
    color: var(--tinta-3);
  }

  .filas {
    display: grid;
    gap: 0;
    margin-top: 6px;
  }

  .fila {
    display: grid;
    grid-template-columns: 72px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 16px 0;
    border-bottom: 2px solid var(--linea);
  }

  .mini {
    display: block;
    aspect-ratio: 2 / 3;
    border: 2px solid var(--linea);
    background: var(--c, var(--papel-3));
    box-shadow: 3px 3px 0 var(--sombra);
  }

  .mini img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    min-width: 0;
    display: grid;
    gap: 7px;
  }

  .nombre {
    font-weight: 780;
    font-size: 16.5px;
    line-height: 1.2;
    text-decoration: none;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Un recuadro por episodio, como viñetas: tinta lo visto, magenta lo que ya salió y te falta. */
  .barra {
    display: flex;
    gap: 2px;
    height: 10px;
  }

  .barra i {
    flex: 1;
    min-width: 2px;
    max-width: 22px;
    border: 1.5px solid var(--linea);
  }

  .barra .visto {
    background: var(--tinta);
  }

  .barra .salio {
    background: var(--magenta);
    border-color: var(--magenta);
  }

  .barra .falta {
    border-color: var(--tinta-3);
    opacity: 0.6;
  }

  .vas {
    font-size: 14px;
    color: var(--tinta-2);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }

  .nuevos {
    padding: 1px 8px;
    background: var(--magenta);
    color: var(--sobre-magenta);
    font-size: 12.5px;
    font-weight: 800;
  }

  .sig {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
    font-weight: 650;
  }

  .sig :global(svg) {
    width: 16px;
    height: 16px;
    flex: none;
  }

  .sumar {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 2px solid var(--linea);
    background: var(--papel);
    font-family: var(--titulo);
    font-size: 19px;
    box-shadow: 3px 3px 0 var(--sombra);
    transition:
      transform 0.08s,
      box-shadow 0.08s;
  }

  .con-nuevos .sumar {
    background: var(--magenta);
    color: var(--sobre-magenta);
  }

  .sumar:active:not(:disabled) {
    transform: translate(2px, 2px) scale(0.96);
    box-shadow: 1px 1px 0 var(--sombra);
  }

  .sumar:disabled {
    opacity: 0.35;
    cursor: default;
  }

  @media (min-width: 720px) {
    .filas {
      grid-template-columns: 1fr 1fr;
      column-gap: 40px;
    }
  }
</style>
