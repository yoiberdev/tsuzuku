<script lang="ts">
  import { App as Sistema } from '@capacitor/app'
  import Icono from './componentes/Icono.svelte'
  import { alTocarAviso, nativa, programarAvisos } from './lib/avisos'
  import { abrirAnime, ajustes, iniciarRuta, permisos, pestaña, ruta, toast, volver, type Pestaña } from './lib/estado.svelte'
  import { actualizar, entradas, lista, porVer } from './lib/lista.svelte'
  import Ajustes from './pantallas/Ajustes.svelte'
  import Anime from './pantallas/Anime.svelte'
  import Buscar from './pantallas/Buscar.svelte'
  import Calendario from './pantallas/Calendario.svelte'
  import MiLista from './pantallas/MiLista.svelte'
  import Temporada from './pantallas/Temporada.svelte'

  // Sin lista todavía, se abre en la temporada.
  iniciarRuta(entradas().length ? 'lista' : 'temporada')

  const PESTAÑAS: { id: Pestaña; nombre: string; icono: string }[] = [
    { id: 'lista', nombre: 'Mi lista', icono: 'lista' },
    { id: 'calendario', nombre: 'Calendario', icono: 'calendario' },
    { id: 'temporada', nombre: 'Temporada', icono: 'temporada' },
    { id: 'buscar', nombre: 'Buscar', icono: 'buscar' },
  ]

  // Las pestañas se montan la primera vez que las abres y después siguen ahí, escondidas, para
  // que al volver estén donde las dejaste.
  let abiertas = $state<Pestaña[]>([])
  $effect(() => {
    if (!abiertas.includes(ruta.pestaña)) abiertas = [...abiertas, ruta.pestaña]
  })

  const pendientes = $derived(entradas().filter((e) => e.estado === 'viendo').reduce((n, e) => n + porVer(e), 0))

  // Al abrir la app y al volver a ella: poner la lista al día, y con eso los avisos.
  async function alDia() {
    if (!entradas().length || Date.now() - lista.revisada < 10 * 60e3) return
    try {
      await actualizar()
    } catch {
      // Sin conexión se sigue con la copia guardada.
    }
  }

  $effect(() => {
    alDia()
    const alVolver = () => document.visibilityState === 'visible' && alDia()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  })

  // Los avisos se reprograman cuando cambia la lista o los ajustes (con un respiro, por si
  // estás tocando +1 varias veces seguidas).
  $effect(() => {
    if (!nativa) return
    // Leer aquí lo que importa para los avisos hace que el efecto se repita cuando cambia.
    for (const e of entradas()) void [e.estado, e.proximos?.[0]?.airingAt]
    void [ajustes.avisos, ajustes.idioma, permisos.avisos]
    const id = setTimeout(() => programarAvisos(entradas(), ajustes.idioma, ajustes.avisos).catch(() => {}), 1500)
    return () => clearTimeout(id)
  })

  $effect(() => {
    if (!nativa) return
    alTocarAviso(abrirAnime)
    // El botón "atrás" de Android: cierra la ficha o los ajustes; en una pestaña, deja la app de fondo.
    const sub = Sistema.addListener('backButton', () => {
      if (!volver()) Sistema.minimizeApp()
    })
    return () => sub.then((s) => s.remove())
  })
</script>

{#each PESTAÑAS as p (p.id)}
  {#if abiertas.includes(p.id)}
    <main class="pantalla" hidden={ruta.pestaña !== p.id} aria-label={p.nombre}>
      {#if p.id === 'lista'}
        <MiLista />
      {:else if p.id === 'calendario'}
        <Calendario />
      {:else if p.id === 'temporada'}
        <Temporada />
      {:else}
        <Buscar />
      {/if}
    </main>
  {/if}
{/each}

{#if ruta.pestaña === 'ajustes'}
  <main class="pantalla" aria-label="Ajustes"><Ajustes /></main>
{/if}

<nav class="pestanas" aria-label="Secciones">
  <span class="marca-riel" lang="ja" aria-hidden="true">つづく</span>
  {#each PESTAÑAS as p (p.id)}
    <button class:activa={ruta.pestaña === p.id} aria-current={ruta.pestaña === p.id ? 'page' : undefined} onclick={() => pestaña(p.id)}>
      <Icono nombre={p.icono} />
      {p.nombre}
      {#if p.id === 'lista' && pendientes}<span class="globo" aria-label="{pendientes} por ver">{pendientes > 99 ? '99+' : pendientes}</span>{/if}
    </button>
  {/each}
</nav>

{#if ruta.anime != null}
  {#key ruta.anime}
    <Anime id={ruta.anime} />
  {/key}
{/if}

<div class="franja-estado" aria-hidden="true"></div>

{#if toast.texto}
  {#key toast.n}
    <div class="toast" role="status">{toast.texto}</div>
  {/key}
{/if}
