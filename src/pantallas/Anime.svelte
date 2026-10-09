<script lang="ts">
  import ControlLista from '../componentes/ControlLista.svelte'
  import Estados from '../componentes/Estados.svelte'
  import Icono from '../componentes/Icono.svelte'
  import Tarjeta from '../componentes/Tarjeta.svelte'
  import { anime, ErrorAniList } from '../lib/anilist'
  import { nativa } from '../lib/avisos'
  import { ajustes, pestaña, volver } from '../lib/estado.svelte'
  import { cuando, emision, falta, fecha, formato, fuente, genero, horaDe, otroTitulo, relacion, temporadaNombre, titulo } from '../lib/formato'
  import { puedeTraducir, sinopsis, sinopsisEnEspañol, traducir } from '../lib/texto'
  import type { Detalle, Enlace } from '../lib/tipos'

  let { id }: { id: number } = $props()

  let a = $state.raw<Detalle | null>(null)
  let error = $state('')
  // La sinopsis en español: la del servicio de traducción o, si no hay, la del traductor del
  // navegador. `original` es si elegiste ver el inglés.
  let traduccion = $state.raw<{ parrafos: string[]; por: 'servicio' | 'navegador' } | null>(null)
  let buscandoEs = $state(false)
  let original = $state(false)
  let traduciendo = $state(false)
  let errorTraduccion = $state('')
  let trailer = $state(false)
  let ahora = $state(Date.now())

  async function cargar() {
    error = ''
    try {
      a = (await anime(id)).Media
    } catch (e) {
      error = (e as ErrorAniList).message
    }
  }

  $effect(() => {
    cargar()
    const reloj = setInterval(() => (ahora = Date.now()), 30e3)
    return () => clearInterval(reloj)
  })

  $effect(() => {
    if (!a) return
    const antes = document.title
    document.title = `${titulo(a.title, ajustes.idioma)} · Tsuzuku`
    return () => (document.title = antes)
  })

  const texto = $derived(sinopsis(a?.description ?? null))

  $effect(() => {
    if (!a?.description || !ajustes.sinopsisEs) return
    const cual = a.id
    buscandoEs = true
    sinopsisEnEspañol(cual)
      .then((d) => {
        if (d && a?.id === cual && !traduccion) traduccion = { parrafos: d.parrafos, por: 'servicio' }
      })
      .finally(() => (buscandoEs = false))
  })

  // Una sola entrada por plataforma; si la misma está en varios idiomas, se dice cuál es cuál.
  const plataformas = $derived.by(() => {
    const vistos = new Map<string, Enlace>()
    for (const l of a?.externalLinks ?? []) {
      if (l.type !== 'STREAMING' || l.isDisabled) continue
      const k = `${l.site}|${l.language ?? ''}`
      if (!vistos.has(k)) vistos.set(k, l)
    }
    return [...vistos.values()]
  })

  const proximos = $derived((a?.airingSchedule.nodes ?? []).filter((p) => p.airingAt * 1000 > ahora))
  const relacionados = $derived((a?.relations.edges ?? []).filter((e) => e.node.type === 'ANIME'))
  const recomendados = $derived((a?.recommendations.nodes ?? []).map((n) => n.mediaRecommendation).filter((m) => m != null))

  const IDIOMAS: Record<string, string> = { Japanese: 'japonés', English: 'inglés', Spanish: 'español', Portuguese: 'portugués', French: 'francés', German: 'alemán', Italian: 'italiano', Korean: 'coreano', Chinese: 'chino' }

  // JustWatch, para ver qué hay en tu país: el país sale del idioma del navegador o de tu zona horaria.
  const ZONAS: Record<string, string> = { Lima: 'pe', Mexico_City: 'mx', Bogota: 'co', Santiago: 'cl', Buenos_Aires: 'ar', Madrid: 'es', Guayaquil: 'ec', Caracas: 've', Montevideo: 'uy', Asuncion: 'py', La_Paz: 'bo', Costa_Rica: 'cr', Guatemala: 'gt', Panama: 'pa' }
  const HISPANOS = new Set(['pe', 'mx', 'co', 'cl', 'ar', 'es', 'ec', 've', 'uy', 'py', 'bo', 'cr', 'gt', 'hn', 'sv', 'pa', 'do'])
  function justWatch(t: string) {
    let pais = navigator.language.split('-')[1]?.toLowerCase()
    if (!pais || pais.length !== 2) pais = ZONAS[Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() ?? ''] ?? 'us'
    return HISPANOS.has(pais) ? `https://www.justwatch.com/${pais}/buscar?q=${encodeURIComponent(t)}` : `https://www.justwatch.com/us/search?q=${encodeURIComponent(t)}`
  }

  async function pasarAEspañol() {
    traduciendo = true
    errorTraduccion = ''
    try {
      traduccion = { parrafos: await traducir(texto.parrafos), por: 'navegador' }
      original = false
    } catch (e) {
      errorTraduccion = (e as Error).message
    } finally {
      traduciendo = false
    }
  }

  function porGenero(g: string) {
    pestaña('buscar', g)
  }

  const duracion = (m: number | null) => (m ? (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}` : `${m} min`) : '')
</script>

<article class="ficha">
  <header class="banner" class:sin-banner={!a?.bannerImage}>
    {#if a}
      <img src={a.bannerImage ?? a.coverImage.extraLarge ?? a.coverImage.large} alt="" />
    {/if}
    <button class="redondo atras" onclick={volver} aria-label="Volver"><Icono nombre="atras" /></button>
  </header>

  <div class="contenido cuerpo">
    {#if error}
      <Estados {error} reintentar={cargar} />
    {:else if !a}
      <div class="presentacion esqueleto" aria-busy="true">
        <div class="cubierta"></div>
        <div class="nombre"></div>
      </div>
    {:else}
      <div class="presentacion">
        <div class="cubierta" style:--c={a.coverImage.color ?? undefined}>
          <img src={a.coverImage.extraLarge ?? a.coverImage.large} alt="Portada de {titulo(a.title, ajustes.idioma)}" />
          {#if a.averageScore}<span class="sello" title="Nota media en AniList">{a.averageScore}</span>{/if}
        </div>
        <div class="titulos">
          <h1>{titulo(a.title, ajustes.idioma)}</h1>
          {#if otroTitulo(a.title, ajustes.idioma)}<p class="otro">{otroTitulo(a.title, ajustes.idioma)}</p>{/if}
          {#if a.title.native && ajustes.idioma !== 'native'}<p class="nativo" lang="ja">{a.title.native}</p>{/if}
        </div>
      </div>

      <dl class="tecnica">
        {#if a.format}<div><dt>Formato</dt><dd>{formato(a.format)}</dd></div>{/if}
        <div>
          <dt>Episodios</dt>
          <dd>{a.episodes ?? '¿?'}{#if a.duration}<small> × {duracion(a.duration)}</small>{/if}</dd>
        </div>
        <div><dt>Emisión</dt><dd>{emision(a.status)}</dd></div>
        {#if a.season}<div><dt>Temporada</dt><dd>{temporadaNombre(a.season)} {a.seasonYear}</dd></div>{/if}
        {#if a.studios?.nodes.length}<div><dt>Estudio</dt><dd>{a.studios.nodes.map((s) => s.name).join(', ')}</dd></div>{/if}
        {#if a.source}<div><dt>Basado en</dt><dd>{fuente(a.source)}</dd></div>{/if}
        {#if fecha(a.startDate)}<div><dt>Estreno</dt><dd>{fecha(a.startDate)}</dd></div>{/if}
        {#if a.popularity}<div><dt>En listas de AniList</dt><dd>{a.popularity.toLocaleString('es')}</dd></div>{/if}
      </dl>

      <ControlLista anime={a} />

      {#if proximos.length}
        {@const p = proximos[0]}
        <section class="seccion continuara">
          <span class="tsuzuku" lang="ja" aria-hidden="true">つづく</span>
          <div>
            <p class="cuando-sale">
              El episodio <b>{p.episode}</b> sale {cuando(p.airingAt, ahora)} a las {horaDe(p.airingAt)}
            </p>
            <p class="cuenta">Faltan {falta(p.airingAt, ahora)}</p>
            {#if proximos.length > 1}
              <p class="despues">
                Después:
                {#each proximos.slice(1, 4) as q, i (q.episode)}{i ? ', ' : ''}ep {q.episode} {cuando(q.airingAt, ahora)}{/each}
              </p>
            {/if}
          </div>
        </section>
      {/if}

      <section class="seccion">
        <h2>Dónde verlo</h2>
        {#if plataformas.length}
          <div class="plataformas">
            {#each plataformas as l (l.url)}
              <a class="plataforma" href={l.url} target="_blank" rel="noopener noreferrer" style:--marca={l.color ?? undefined}>
                {#if l.icon}<img src={l.icon} alt="" />{:else}<i></i>{/if}
                <span>
                  <b>{l.site}</b>
                  {#if l.language}<small>en {IDIOMAS[l.language] ?? l.language}</small>{/if}
                </span>
                <Icono nombre="externo" />
              </a>
            {/each}
          </div>
          <p class="nota">Lo que hay en cada plataforma cambia según el país. <a class="enlace" href={justWatch(titulo(a.title, 'english'))} target="_blank" rel="noopener noreferrer">Buscarlo en JustWatch</a> para ver qué hay en el tuyo.</p>
        {:else}
          <p class="nota">
            AniList no tiene plataformas para este anime.
            <a class="enlace" href={justWatch(titulo(a.title, 'english'))} target="_blank" rel="noopener noreferrer">Buscarlo en JustWatch</a>.
          </p>
        {/if}
      </section>

      {#if a.trailer?.site === 'youtube'}
        <section class="seccion">
          <h2>Tráiler</h2>
          {#if trailer && !nativa}
            <div class="video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/{a.trailer.id}?autoplay=1&rel=0"
                title="Tráiler de {titulo(a.title, ajustes.idioma)}"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
              ></iframe>
            </div>
          {:else if nativa}
            <!-- En la app, el tráiler se abre en YouTube en vez de incrustarse en la vista web. -->
            <a class="video miniatura" href="https://www.youtube.com/watch?v={a.trailer.id}" target="_blank" rel="noopener noreferrer" aria-label="Ver el tráiler en YouTube">
              <img src="https://i.ytimg.com/vi/{a.trailer.id}/hqdefault.jpg" alt="" loading="lazy" />
              <span class="play"><Icono nombre="play" /></span>
            </a>
          {:else}
            <button class="video miniatura" onclick={() => (trailer = true)} aria-label="Ver el tráiler">
              <img src="https://i.ytimg.com/vi/{a.trailer.id}/hqdefault.jpg" alt="" loading="lazy" />
              <span class="play"><Icono nombre="play" /></span>
            </button>
          {/if}
        </section>
      {/if}

      {#if texto.parrafos.length}
        {@const enEspañol = !!traduccion && !original}
        {@const deAniList = `AniList${texto.fuente ? `, que la toma de ${texto.fuente}` : ''}`}
        <section class="seccion sinopsis">
          <h2>Sinopsis {#if !enEspañol && !buscandoEs}<small>en inglés</small>{/if}</h2>
          {#if buscandoEs && !traduccion}
            <div class="lineas" aria-busy="true" aria-label="Traduciendo la sinopsis">
              <i></i><i></i><i></i><i></i>
            </div>
          {:else}
            {#each enEspañol && traduccion ? traduccion.parrafos : texto.parrafos as p, i (i)}<p>{p}</p>{/each}
            <p class="credito">
              {#if enEspañol && traduccion?.por === 'servicio'}
                Traducción automática de Google. El original, en inglés, es de {deAniList}.
              {:else if enEspañol}
                Traducida por tu navegador. El original, en inglés, es de {deAniList}.
              {:else}
                De {deAniList}.
              {/if}
              {#if enEspañol}
                <button class="enlace" onclick={() => (original = true)}>Ver el original</button>
              {:else if traduccion}
                <button class="enlace" onclick={() => (original = false)}>Ver en español</button>
              {:else if puedeTraducir()}
                <button class="enlace" onclick={pasarAEspañol} disabled={traduciendo}>{traduciendo ? 'Traduciendo…' : 'Traducir al español'}</button>
              {/if}
            </p>
          {/if}
          {#if errorTraduccion}<p class="credito">{errorTraduccion}</p>{/if}
        </section>
      {/if}

      {#if a.genres.length}
        <div class="chips generos">
          {#each a.genres as g (g)}<button class="chip" onclick={() => porGenero(g)}>{genero(g)}</button>{/each}
        </div>
      {/if}

      {#if relacionados.length}
        <section class="seccion">
          <h2>Relacionados</h2>
          <div class="carril">
            {#each relacionados as r (r.node.id)}
              <Tarjeta anime={r.node} etiqueta="{relacion(r.relationType)} · {formato(r.node.format)}" proximo={false} />
            {/each}
          </div>
        </section>
      {/if}

      {#if a.characters.edges.length}
        <section class="seccion">
          <h2>Personajes</h2>
          <div class="personajes">
            {#each a.characters.edges as c (c.node.id)}
              <figure>
                {#if c.node.image.medium}<img src={c.node.image.medium} alt="" loading="lazy" />{:else}<i></i>{/if}
                <figcaption>
                  <b>{c.node.name.full}</b>
                  {#if c.voiceActors[0]}<span>Voz: {c.voiceActors[0].name.full}</span>{/if}
                </figcaption>
              </figure>
            {/each}
          </div>
        </section>
      {/if}

      {#if recomendados.length}
        <section class="seccion">
          <h2>Si te gusta, prueba con</h2>
          <div class="carril">
            {#each recomendados as m (m.id)}
              <Tarjeta anime={m} proximo={false} />
            {/each}
          </div>
        </section>
      {/if}

      <p class="pie">
        Datos de <a class="enlace" href={a.siteUrl} target="_blank" rel="noopener noreferrer">AniList</a>
        {#if a.idMal}· <a class="enlace" href="https://myanimelist.net/anime/{a.idMal}" target="_blank" rel="noopener noreferrer">MyAnimeList</a>{/if}
      </p>
    {/if}
  </div>
</article>

<style>
  .ficha {
    position: fixed;
    z-index: 30;
    inset: 0 0 0 var(--riel);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    background: var(--papel);
    padding-bottom: calc(40px + var(--safe-bottom));
    animation: desliza 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes desliza {
    from {
      transform: translateX(28px);
      opacity: 0;
    }
  }

  /* El banner, impreso a dos tintas: la imagen en grises multiplicada sobre magenta. */
  .banner {
    position: relative;
    height: calc(clamp(170px, 36vw, 340px) + var(--safe-top));
    background: var(--magenta);
    overflow: hidden;
  }

  .banner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(1) contrast(1.25) brightness(1.08);
    mix-blend-mode: multiply;
  }

  .sin-banner img {
    object-position: center 22%;
    filter: grayscale(1) contrast(1.25) brightness(1.08) blur(2px);
    transform: scale(1.05);
  }

  .banner::after {
    content: '';
    position: absolute;
    inset: 40% 0 0;
    background-image: radial-gradient(var(--papel) 1.3px, transparent 1.8px);
    background-size: 7px 7px;
    mask-image: linear-gradient(to bottom, transparent, #000);
  }

  .atras {
    position: absolute;
    z-index: 2;
    top: calc(var(--safe-top) + 12px);
    left: 14px;
    box-shadow: 3px 3px 0 var(--sombra);
  }

  .cuerpo {
    position: relative;
    max-width: 980px;
  }

  /* La portada se monta sobre el banner; el título queda debajo, sobre el papel. */
  .presentacion {
    display: grid;
    grid-template-columns: clamp(118px, 30vw, 210px) 1fr;
    gap: 18px;
    align-items: start;
    margin-top: 16px;
    position: relative;
    z-index: 1;
  }

  .presentacion .cubierta {
    position: relative;
    margin-top: calc(clamp(70px, 14vw, 140px) * -1 - 16px);
    aspect-ratio: 2 / 3;
    border: 3px solid var(--linea);
    background: var(--c, var(--papel-3));
    box-shadow: 6px 6px 0 var(--sombra);
  }

  .presentacion .cubierta img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .presentacion.esqueleto .nombre {
    height: 28px;
    background: var(--papel-2);
  }

  .titulos {
    min-width: 0;
  }

  h1 {
    font-family: var(--titulo);
    font-size: clamp(23px, 5.6vw, 42px);
    line-height: 1.08;
    overflow-wrap: anywhere;
  }

  .otro {
    margin-top: 8px;
    font-weight: 650;
    color: var(--tinta-2);
    font-size: 15px;
  }

  .nativo {
    margin-top: 2px;
    color: var(--tinta-3);
    font-size: 14px;
  }

  .tecnica {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0;
    margin: 26px 0 0;
    border-top: 2px solid var(--linea);
    border-left: 2px solid var(--linea);
  }

  .tecnica div {
    padding: 9px 12px;
    border-right: 2px solid var(--linea);
    border-bottom: 2px solid var(--linea);
  }

  .tecnica dt {
    font-size: 11.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tinta-3);
  }

  .tecnica dd {
    margin: 2px 0 0;
    font-weight: 700;
    font-size: 15px;
  }

  .tecnica small {
    font-weight: 600;
    color: var(--tinta-2);
  }

  /* "Continuará", como la tarjeta del final de un episodio. */
  .continuara {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 18px;
    align-items: center;
    padding: 18px;
    background: var(--tinta);
    color: var(--papel);
    box-shadow: 5px 5px 0 var(--magenta);
  }

  .tsuzuku {
    writing-mode: vertical-rl;
    font-family: var(--titulo);
    font-size: 30px;
    line-height: 1;
    color: var(--amarillo);
  }

  .cuando-sale {
    font-size: 17px;
    font-weight: 650;
  }

  .cuando-sale b {
    font-family: var(--titulo);
    font-weight: 400;
    font-size: 22px;
  }

  .cuenta {
    margin-top: 4px;
    font-family: var(--titulo);
    font-size: 26px;
    color: var(--amarillo);
  }

  .despues {
    margin-top: 6px;
    font-size: 13.5px;
    opacity: 0.75;
  }

  .plataformas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .plataforma {
    display: grid;
    grid-template-columns: 36px 1fr 20px;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 2px solid var(--linea);
    border-left: 8px solid var(--marca, var(--linea));
    background: var(--papel);
    text-decoration: none;
    box-shadow: 3px 3px 0 var(--sombra);
  }

  .plataforma img,
  .plataforma i {
    width: 36px;
    height: 36px;
    padding: 6px;
    background: var(--marca, var(--tinta));
    object-fit: contain;
  }

  .plataforma span {
    display: grid;
  }

  .plataforma b {
    font-size: 16px;
  }

  .plataforma small {
    color: var(--tinta-2);
    font-size: 12.5px;
  }

  .plataforma :global(svg) {
    width: 20px;
    height: 20px;
  }

  .nota {
    margin-top: 12px;
    font-size: 14px;
    color: var(--tinta-2);
  }

  .video {
    position: relative;
    display: block;
    width: 100%;
    max-width: 720px;
    aspect-ratio: 16 / 9;
    border: 2px solid var(--linea);
    box-shadow: 4px 4px 0 var(--sombra);
    background: #000;
  }

  .video iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  .miniatura img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    width: 68px;
    height: 68px;
    margin: -34px 0 0 -34px;
    border-radius: 50%;
    background: var(--magenta);
    color: var(--sobre-magenta);
    border: 3px solid var(--linea);
  }

  .play :global(svg) {
    width: 30px;
    height: 30px;
    margin-left: 4px;
  }

  .sinopsis p {
    max-width: 68ch;
    margin-bottom: 12px;
    font-size: 16px;
    line-height: 1.6;
  }

  .lineas {
    display: grid;
    gap: 10px;
    max-width: 68ch;
  }

  .lineas i {
    height: 14px;
    background: var(--papel-2);
    animation: latido 1.2s ease-in-out infinite alternate;
  }

  .lineas i:last-child {
    width: 60%;
  }

  .sinopsis .credito {
    font-size: 13.5px;
    color: var(--tinta-3);
  }

  .generos {
    margin-top: 20px;
  }

  .personajes {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 112px;
    gap: 16px;
    overflow-x: auto;
    padding: 4px var(--margen) 10px;
    margin: 0 calc(var(--margen) * -1);
    scrollbar-width: none;
  }

  .personajes figure {
    margin: 0;
    display: grid;
    gap: 8px;
    justify-items: center;
    text-align: center;
  }

  .personajes img,
  .personajes i {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--linea);
    background: var(--papel-2);
  }

  .personajes b {
    display: block;
    font-size: 13.5px;
    line-height: 1.2;
  }

  .personajes span {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--tinta-2);
  }

  .pie {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 2px solid var(--linea);
    font-size: 14px;
    color: var(--tinta-2);
  }
</style>
