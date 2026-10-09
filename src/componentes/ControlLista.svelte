<script lang="ts">
  import { nativa, pedirPermisoAvisos, permisoAvisos } from '../lib/avisos'
  import { ajustes, avisar, permisos } from '../lib/estado.svelte'
  import { ESTADOS, emitidos } from '../lib/formato'
  import { avanzar, entrada, fijarProgreso, poner, quitar, tope } from '../lib/lista.svelte'
  import type { Estado, Tarjeta } from '../lib/tipos'
  import Icono from './Icono.svelte'

  let { anime }: { anime: Tarjeta } = $props()

  const mia = $derived(entrada(anime.id))
  const salidos = $derived(emitidos(anime))
  let confirmar = $state(false)

  async function elegir(estado: Estado) {
    const nuevo = !mia
    poner(anime, estado)
    if (nuevo) avisar(estado === 'viendo' ? 'Agregado a «Viendo».' : 'Agregado a «Por ver».')
    // El permiso de avisos se pide la primera vez que empiezas a ver algo que sigue emitiéndose.
    if (estado === 'viendo' && nativa && ajustes.avisos && anime.status !== 'FINISHED' && (await permisoAvisos()) === 'prompt') {
      if (await pedirPermisoAvisos()) {
        permisos.avisos++
        avisar('Te avisaré cuando salga cada episodio.')
      }
    }
  }

  function sumar(paso: number) {
    if (avanzar(anime.id, paso) === 'terminado') avisar('Terminado. Pasó a vistos.')
  }
</script>

<section class="control" aria-label="Mi lista">
  {#if !mia}
    <div class="agregar">
      <button class="boton primario" onclick={() => elegir('viendo')}><Icono nombre="mas" /> Lo estoy viendo</button>
      <button class="boton" onclick={() => elegir('pendiente')}>Para ver después</button>
    </div>
  {:else}
    <div class="estados" role="radiogroup" aria-label="Estado en mi lista">
      {#each ESTADOS as e (e.id)}
        <button role="radio" aria-checked={mia.estado === e.id} onclick={() => elegir(e.id)}>{e.corto}</button>
      {/each}
    </div>
    <div class="progreso">
      <button class="redondo" onclick={() => sumar(-1)} disabled={mia.progreso <= 0} aria-label="Un episodio menos"><Icono nombre="menos" /></button>
      <label>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          max={anime.episodes ?? undefined}
          value={mia.progreso}
          onchange={(e) => fijarProgreso(anime.id, Math.min(anime.episodes ?? Infinity, Number(e.currentTarget.value) || 0))}
          aria-label="Episodios vistos"
        />
        <span>
          {anime.episodes ? `de ${anime.episodes} episodios` : 'episodios vistos'}
          {#if salidos != null && salidos > mia.progreso && salidos !== anime.episodes}<small>· salieron {salidos}</small>{/if}
        </span>
      </label>
      <button class="redondo mas1" onclick={() => sumar(1)} disabled={mia.progreso >= tope(anime)} aria-label="Un episodio más"><Icono nombre="mas" /></button>
    </div>
    <p class="quitar">
      {#if confirmar}
        ¿Seguro? <button class="enlace" onclick={() => (quitar(anime.id), (confirmar = false), avisar('Quitado de tu lista.'))}>Sí, quitar</button>
        · <button class="enlace" onclick={() => (confirmar = false)}>No</button>
      {:else}
        <button class="enlace" onclick={() => (confirmar = true)}>Quitar de mi lista</button>
      {/if}
    </p>
  {/if}
</section>

<style>
  .control {
    margin-top: 22px;
    display: grid;
    gap: 14px;
  }

  .agregar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    max-width: 520px;
  }

  .agregar .boton {
    padding: 0 10px;
  }

  .estados {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border: 2px solid var(--linea);
    box-shadow: 3px 3px 0 var(--sombra);
  }

  .estados button {
    height: 44px;
    font-size: 13.5px;
    font-weight: 750;
    background: var(--papel);
  }

  .estados button + button {
    border-left: 2px solid var(--linea);
  }

  .estados button[aria-checked='true'] {
    background: var(--tinta);
    color: var(--papel);
  }

  .progreso {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 14px;
  }

  .progreso label {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .progreso input {
    width: 3.2ch;
    min-width: 56px;
    padding: 0;
    border: 0;
    border-bottom: 3px solid var(--linea);
    background: none;
    font-family: var(--titulo);
    font-size: 34px;
    line-height: 1.1;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .progreso input::-webkit-inner-spin-button,
  .progreso input::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }

  .progreso span {
    font-weight: 650;
    color: var(--tinta-2);
  }

  .progreso small {
    color: var(--magenta);
    font-weight: 750;
    font-size: 14px;
  }

  .mas1 {
    background: var(--magenta);
    color: var(--sobre-magenta);
  }

  .redondo:disabled {
    opacity: 0.35;
  }

  .quitar {
    font-size: 14px;
    color: var(--tinta-2);
  }
</style>
