<script lang="ts">
  import { tick } from 'svelte'
  import Estados from '../componentes/Estados.svelte'
  import { calendario, ErrorAniList } from '../lib/anilist'
  import { abrirAnime, ajustes } from '../lib/estado.svelte'
  import { diaCortoDe, diaMesDe, formato, horaDe, inicioDelDia, titulo } from '../lib/formato'
  import { entrada } from '../lib/lista.svelte'
  import type { EnCalendario } from '../lib/tipos'

  // Una guía de programación como las de la tele japonesa: los episodios del día, hora por hora,
  // en tu hora local.
  const hoy = inicioDelDia()
  const dias = Array.from({ length: 7 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i))

  let elegido = $state(0)
  let soloMios = $state(false)
  let items = $state.raw<EnCalendario[]>([])
  let cargando = $state(true)
  let error = $state('')
  let ahora = $state(Date.now())
  let pantalla = $state<HTMLElement>()

  $effect(() => {
    const id = setInterval(() => (ahora = Date.now()), 30e3)
    return () => clearInterval(id)
  })

  async function cargar(i: number) {
    cargando = true
    error = ''
    const desde = Math.floor(dias[i].getTime() / 1000)
    const hasta = desde + 86400
    try {
      const todos: EnCalendario[] = []
      for (let page = 1; page <= 5; page++) {
        const r = await calendario(desde - 1, hasta, page)
        todos.push(...r.Page.airingSchedules)
        if (!r.Page.pageInfo.hasNextPage) break
      }
      if (i !== elegido) return
      items = todos.filter((x) => !x.media.isAdult)
      cargando = false
      if (i === 0) {
        await tick()
        pantalla?.querySelector('.ahora')?.scrollIntoView({ block: 'center' })
      }
    } catch (e) {
      if (i !== elegido) return
      error = (e as ErrorAniList).message
      cargando = false
    }
  }

  $effect(() => {
    cargar(elegido)
  })

  const visibles = $derived(soloMios ? items.filter((x) => entrada(x.media.id)) : items)
  const mios = $derived(items.filter((x) => entrada(x.media.id)).length)

  // Agrupados por hora; en el día de hoy, la línea de "ahora" va antes del primero que no salió.
  const grupos = $derived.by(() => {
    const out: { hora: string; items: EnCalendario[]; ahoraAntes: boolean }[] = []
    let marcado = elegido !== 0
    for (const x of visibles) {
      const h = horaDe(x.airingAt)
      let g = out[out.length - 1]
      const futuro = x.airingAt * 1000 > ahora
      if (!g || g.hora !== h) {
        g = { hora: h, items: [], ahoraAntes: !marcado && futuro }
        if (g.ahoraAntes) marcado = true
        out.push(g)
      }
      g.items.push(x)
    }
    return { out, ahoraAlFinal: !marcado && out.length > 0 }
  })

  const nombreDia = (d: Date, i: number) => (i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : diaCortoDe(d))
</script>

<div class="contenido" bind:this={pantalla}>
  <header class="cabecera">
    <div>
      <h1>Calendario</h1>
      <span class="bajada">Los estrenos de la semana en tu hora local</span>
    </div>
    <span class="kana">放送予定</span>
  </header>

  <div class="dias" role="tablist" aria-label="Día">
    {#each dias as d, i (i)}
      <button role="tab" aria-selected={elegido === i} onclick={() => (elegido = i)}>
        <span class="dn">{nombreDia(d, i)}</span>
        <b>{d.getDate()}</b>
        <span class="mes">{diaMesDe(d).split(' ')[1]}</span>
      </button>
    {/each}
  </div>

  <div class="chips" role="radiogroup" aria-label="Qué mostrar">
    <button class="chip" role="radio" aria-checked={!soloMios} onclick={() => (soloMios = false)}>Todo <span class="n">{items.length}</span></button>
    <button class="chip" role="radio" aria-checked={soloMios} onclick={() => (soloMios = true)}>De mi lista <span class="n">{mios}</span></button>
  </div>

  {#if cargando || error}
    {#if cargando && !error}
      <div class="guia esqueleto-guia" aria-busy="true">
        {#each { length: 6 } as _, i (i)}<div class="hueco"></div>{/each}
      </div>
    {:else}
      <Estados {error} reintentar={() => cargar(elegido)} />
    {/if}
  {:else if !visibles.length}
    <p class="nada">{soloMios ? 'Nada de tu lista se emite este día.' : 'AniList no tiene estrenos para este día.'}</p>
  {:else}
    <ol class="guia">
      {#each grupos.out as g (g.hora)}
        {#if g.ahoraAntes}
          <li class="ahora"><span>Ahora · {horaDe(ahora / 1000)}</span></li>
        {/if}
        <li class="franja" class:paso={g.items[0].airingAt * 1000 <= ahora}>
          <time>{g.hora}</time>
          <div class="programas">
            {#each g.items as x (x.id)}
              {@const mia = entrada(x.media.id)}
              <a
                class="programa"
                class:mio={!!mia}
                href="#/anime/{x.media.id}"
                onclick={(ev) => {
                  ev.preventDefault()
                  abrirAnime(x.media.id)
                }}
              >
                <span class="mini" style:--c={x.media.coverImage.color ?? undefined}>
                  <img src={x.media.coverImage.large} alt="" loading="lazy" decoding="async" />
                </span>
                <span class="que">
                  <b>{titulo(x.media.title, ajustes.idioma)}</b>
                  <span class="ep">
                    Episodio {x.episode}{x.media.episodes ? ` de ${x.media.episodes}` : ''}
                    {#if x.media.format && x.media.format !== 'TV'}· {formato(x.media.format)}{/if}
                    {#if x.episode === 1}<em class="estreno">Estreno</em>{/if}
                    {#if x.media.episodes && x.episode === x.media.episodes}<em class="final">Final</em>{/if}
                  </span>
                  {#if mia}<span class="tuyo">En tu lista</span>{/if}
                </span>
              </a>
            {/each}
          </div>
        </li>
      {/each}
      {#if grupos.ahoraAlFinal}
        <li class="ahora"><span>Ahora · {horaDe(ahora / 1000)}</span></li>
      {/if}
    </ol>
  {/if}
</div>

<style>
  .dias {
    display: grid;
    grid-template-columns: repeat(7, minmax(44px, 1fr));
    gap: 6px;
    margin: 6px 0 14px;
  }

  .dias button {
    display: grid;
    justify-items: center;
    gap: 1px;
    padding: 8px 0 7px;
    border: 2px solid var(--linea);
    background: var(--papel);
  }

  .dias .dn {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: capitalize;
  }

  .dias b {
    font-family: var(--titulo);
    font-weight: 400;
    font-size: 21px;
    line-height: 1.1;
  }

  .dias .mes {
    font-size: 11px;
    color: var(--tinta-3);
  }

  .dias button[aria-selected='true'] {
    background: var(--tinta);
    color: var(--papel);
    box-shadow: 3px 3px 0 var(--magenta);
  }

  .dias button[aria-selected='true'] .mes {
    color: inherit;
    opacity: 0.7;
  }

  .nada {
    padding: 30px 0;
    color: var(--tinta-3);
  }

  .guia {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }

  .franja {
    display: grid;
    grid-template-columns: 66px 1fr;
    border-top: 2px solid var(--linea);
  }

  .franja time {
    padding: 12px 0;
    font-family: var(--titulo);
    font-size: 18px;
    line-height: 1.2;
    border-right: 2px solid var(--linea);
  }

  .franja.paso {
    opacity: 0.5;
  }

  .programas {
    display: grid;
  }

  .programa {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 12px;
    align-items: center;
    padding: 10px 0 10px 12px;
    text-decoration: none;
  }

  .programa + .programa {
    border-top: 1px dashed var(--tinta-3);
  }

  .programa.mio {
    background: linear-gradient(90deg, var(--magenta-suave), transparent 75%);
    box-shadow: inset 4px 0 0 var(--magenta);
  }

  .mini {
    display: block;
    aspect-ratio: 2 / 3;
    border: 1.5px solid var(--linea);
    background: var(--c, var(--papel-3));
  }

  .mini img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .que {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .que b {
    font-size: 15px;
    line-height: 1.25;
    font-weight: 750;
  }

  .ep {
    font-size: 13px;
    color: var(--tinta-2);
  }

  .ep em {
    font-style: normal;
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    margin-left: 4px;
  }

  .estreno {
    background: var(--cian);
    color: #fff;
  }

  .final {
    background: var(--amarillo);
    color: #17161b;
  }

  .tuyo {
    font-size: 12px;
    font-weight: 800;
    color: var(--magenta);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* La línea de "ahora", como la aguja de una guía de televisión. */
  .ahora {
    position: relative;
    height: 0;
    border-top: 3px solid var(--magenta);
    margin: 14px 0;
  }

  .ahora span {
    position: absolute;
    top: -13px;
    left: 0;
    padding: 2px 10px;
    background: var(--magenta);
    color: var(--sobre-magenta);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .esqueleto-guia {
    display: grid;
    gap: 10px;
  }

  .hueco {
    height: 64px;
    background-image: radial-gradient(var(--tono) 1.1px, transparent 1.5px);
    background-size: 7px 7px;
    border-top: 2px solid var(--papel-3);
    animation: latido 1.2s ease-in-out infinite alternate;
  }
</style>
