<script lang="ts">
  import Icono from '../componentes/Icono.svelte'
  import { limpiarCache, listaDeAniList, type ErrorAniList } from '../lib/anilist'
  import { nativa, pedirPermisoAvisos, permisoAvisos } from '../lib/avisos'
  import { ajustes, avisar, guardarAjustes, permisos, volver } from '../lib/estado.svelte'
  import type { Idioma } from '../lib/formato'
  import { entradas, importar, respaldo, restaurar, vaciar } from '../lib/lista.svelte'

  let usuario = $state('')
  let importando = $state(false)
  let errorImportar = $state('')
  let permiso = $state<'granted' | 'denied' | 'prompt'>('prompt')
  let borrar = $state(false)

  $effect(() => {
    permisoAvisos().then((p) => (permiso = p))
  })

  const IDIOMAS: { id: Idioma; nombre: string; ejemplo: string }[] = [
    { id: 'romaji', nombre: 'Romaji', ejemplo: 'Sousou no Frieren' },
    { id: 'english', nombre: 'Inglés', ejemplo: "Frieren: Beyond Journey's End" },
    { id: 'native', nombre: 'Japonés', ejemplo: '葬送のフリーレン' },
  ]

  function idioma(i: Idioma) {
    ajustes.idioma = i
    guardarAjustes()
  }

  async function cambiarAvisos() {
    ajustes.avisos = !ajustes.avisos
    guardarAjustes()
    if (ajustes.avisos && permiso !== 'granted') {
      permiso = (await pedirPermisoAvisos()) ? 'granted' : 'denied'
      if (permiso === 'granted') permisos.avisos++
    }
  }

  async function traerDeAniList(e: SubmitEvent) {
    e.preventDefault()
    const u = usuario.trim()
    if (!u) return
    importando = true
    errorImportar = ''
    try {
      const r = await listaDeAniList(u)
      const items = r.MediaListCollection.lists.flatMap((l) => l.entries)
      const n = importar(items)
      avisar(n ? `Se agregaron ${n} animes de ${u}.` : 'Todo eso ya estaba en tu lista.')
      usuario = ''
    } catch (err) {
      errorImportar = (err as ErrorAniList).estado === 404 ? `AniList no tiene una lista pública de «${u}».` : (err as Error).message
    } finally {
      importando = false
    }
  }

  async function exportar() {
    const nombre = `tsuzuku-${new Date().toISOString().slice(0, 10)}.json`
    const texto = respaldo()
    if (nativa) {
      // En la app no hay descargas: el archivo va al caché y se comparte (Drive, WhatsApp, correo…).
      const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const { uri } = await Filesystem.writeFile({ path: nombre, data: texto, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: 'Respaldo de Tsuzuku', files: [uri] }).catch(() => {})
      return
    }
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function abrirRespaldo(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!f) return
    try {
      const n = restaurar(await f.text())
      avisar(n ? `Se recuperaron ${n} animes.` : 'Tu lista ya tenía todo eso.')
    } catch (err) {
      avisar(err instanceof SyntaxError ? 'Ese archivo no se puede leer.' : (err as Error).message)
    }
  }
</script>

<div class="contenido">
  <header class="cabecera">
    <div class="con-atras">
      <button class="redondo" onclick={volver} aria-label="Volver"><Icono nombre="atras" /></button>
      <h1>Ajustes</h1>
    </div>
    <span class="kana">設定</span>
  </header>

  <section class="seccion">
    <h2>Títulos</h2>
    <div class="opciones" role="radiogroup" aria-label="Idioma de los títulos">
      {#each IDIOMAS as i (i.id)}
        <button role="radio" aria-checked={ajustes.idioma === i.id} onclick={() => idioma(i.id)}>
          <b>{i.nombre}</b>
          <span lang={i.id === 'native' ? 'ja' : 'en'}>{i.ejemplo}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="seccion">
    <h2>Sinopsis</h2>
    <button class="interruptor" role="switch" aria-checked={ajustes.sinopsisEs} onclick={() => ((ajustes.sinopsisEs = !ajustes.sinopsisEs), guardarAjustes())}>
      <span>Mostrarla en español, con traducción automática de Google</span>
      <i></i>
    </button>
    <p class="nota">AniList solo tiene las sinopsis en inglés. Cada una se traduce una vez en el servidor de Tsuzuku, que solo recibe el número del anime.</p>
  </section>

  <section class="seccion">
    <h2>Avisos de estreno</h2>
    {#if nativa}
      <button class="interruptor" role="switch" aria-checked={ajustes.avisos && permiso === 'granted'} onclick={cambiarAvisos}>
        <span>Avisarme cuando sale un episodio de lo que estoy viendo</span>
        <i></i>
      </button>
      {#if ajustes.avisos && permiso === 'denied'}
        <p class="nota">Android tiene bloqueados los avisos de Tsuzuku. Actívalos en Ajustes → Apps → Tsuzuku → Notificaciones.</p>
      {/if}
    {:else}
      <p class="nota">Los avisos funcionan en la app de Android. En la web, «Mi lista» te muestra qué salió y qué sale hoy.</p>
    {/if}
  </section>

  <section class="seccion">
    <h2>Traer tu lista de AniList</h2>
    <p class="nota">Si ya llevas tu lista en AniList, escribe tu usuario y se suma a la de aquí. Tiene que ser pública; no hace falta contraseña.</p>
    <form class="importar" onsubmit={traerDeAniList}>
      <input type="text" bind:value={usuario} placeholder="Tu usuario de AniList" aria-label="Usuario de AniList" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <button class="boton tinta" disabled={importando || !usuario.trim()}>{importando ? 'Trayendo…' : 'Traer'}</button>
    </form>
    {#if errorImportar}<p class="nota error-texto">{errorImportar}</p>{/if}
  </section>

  <section class="seccion">
    <h2>Respaldo</h2>
    <p class="nota">Tu lista se guarda solo en este {nativa ? 'teléfono' : 'navegador'}. Con un respaldo la pasas a otro o la recuperas si borras los datos.</p>
    <div class="botones">
      <button class="boton" onclick={exportar} disabled={!entradas().length}>Guardar un respaldo</button>
      <label class="boton">
        Abrir un respaldo
        <input class="oculto" type="file" accept="application/json,.json" onchange={abrirRespaldo} />
      </label>
    </div>
  </section>

  <section class="seccion">
    <h2>Datos</h2>
    <div class="botones">
      <button class="boton" onclick={() => (limpiarCache(), avisar('Listo. Lo próximo se pide de nuevo a AniList.'))}>Vaciar el caché</button>
      {#if borrar}
        <button class="boton primario" onclick={() => (vaciar(), (borrar = false), avisar('Tu lista quedó vacía.'))}>Sí, borrar mi lista</button>
        <button class="boton" onclick={() => (borrar = false)}>No</button>
      {:else}
        <button class="boton" onclick={() => (borrar = true)} disabled={!entradas().length}>Borrar mi lista</button>
      {/if}
    </div>
  </section>

  <section class="seccion acerca">
    <p><b class="logo">Tsuzuku</b> <span lang="ja">つづく</span> quiere decir «continuará», lo que sale al final de cada episodio.</p>
    <p>
      Los datos son de <a class="enlace" href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>. Tsuzuku no tiene episodios: te dice dónde verlos y lleva la cuenta de lo que vas viendo.
    </p>
  </section>
</div>

<style>
  .con-atras {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .opciones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .opciones button {
    display: grid;
    gap: 2px;
    padding: 12px 14px;
    text-align: left;
    border: 2px solid var(--linea);
    background: var(--papel);
  }

  .opciones button span {
    font-size: 13.5px;
    color: var(--tinta-2);
  }

  .opciones button[aria-checked='true'] {
    background: var(--tinta);
    color: var(--papel);
    box-shadow: 3px 3px 0 var(--magenta);
  }

  .opciones button[aria-checked='true'] span {
    color: inherit;
    opacity: 0.75;
  }

  .interruptor {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    max-width: 560px;
    padding: 12px 0;
    text-align: left;
    font-weight: 650;
  }

  .interruptor i {
    position: relative;
    flex: none;
    width: 54px;
    height: 30px;
    border: 2px solid var(--linea);
    border-radius: 15px;
    background: var(--papel-2);
  }

  .interruptor i::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--tinta);
    transition: transform 0.15s;
  }

  .interruptor[aria-checked='true'] i {
    background: var(--magenta);
  }

  .interruptor[aria-checked='true'] i::after {
    transform: translateX(24px);
    background: var(--sobre-magenta);
  }

  .nota {
    max-width: 62ch;
    color: var(--tinta-2);
    font-size: 14.5px;
    margin-bottom: 12px;
  }

  .error-texto {
    color: var(--magenta);
    font-weight: 650;
  }

  .importar {
    display: flex;
    gap: 10px;
    max-width: 520px;
  }

  .importar input {
    flex: 1;
    min-width: 0;
    height: 46px;
    padding: 0 12px;
    border: 2px solid var(--linea);
    background: var(--papel);
    font-weight: 600;
    border-radius: 0;
  }

  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .acerca {
    padding-top: 20px;
    border-top: 2px solid var(--linea);
    display: grid;
    gap: 8px;
    color: var(--tinta-2);
    font-size: 14.5px;
    max-width: 62ch;
  }

  .logo {
    font-family: var(--titulo);
    font-weight: 400;
    color: var(--tinta);
  }
</style>
