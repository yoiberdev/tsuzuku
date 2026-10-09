<script lang="ts">
  // Íconos de trazo, con puntas cuadradas como de rotulador.
  let { nombre }: { nombre: string } = $props()
</script>

<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
  {#if nombre === 'lista'}
    <path d="M4 5h3M4 12h3M4 19h3M10 5h10M10 12h10M10 19h6" />
  {:else if nombre === 'calendario'}
    <path d="M3.5 6.5h17v14h-17zM3.5 10.5h17M8 3.5v4M16 3.5v4" />
    <path d="M7.5 14.5h3v3h-3z" fill="currentColor" stroke-width="1" />
  {:else if nombre === 'temporada'}
    <path d="M12 3.5l2.1 5.4 5.4 2.1-5.4 2.1L12 18.5l-2.1-5.4L4.5 11l5.4-2.1z" />
    <path d="M18.5 16.5v4M16.5 18.5h4" />
  {:else if nombre === 'buscar'}
    <path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5L20.5 20.5" />
  {:else if nombre === 'atras'}
    <path d="M14.5 5l-7 7 7 7" />
  {:else if nombre === 'izquierda'}
    <path d="M14 6l-6 6 6 6" />
  {:else if nombre === 'derecha'}
    <path d="M10 6l6 6-6 6" />
  {:else if nombre === 'ajustes'}
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <path d="M15 4.5v5M9 14.5v5" />
  {:else if nombre === 'mas'}
    <path d="M12 5v14M5 12h14" />
  {:else if nombre === 'menos'}
    <path d="M5 12h14" />
  {:else if nombre === 'play'}
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  {:else if nombre === 'externo'}
    <path d="M13.5 4.5h6v6M19.5 4.5l-8 8M10 6.5H4.5v13h13V14" />
  {:else if nombre === 'campana'}
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4" />
  {:else if nombre === 'cerrar'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if nombre === 'check'}
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  {:else if nombre === 'traducir'}
    <path d="M4 5.5h9M8.5 3.5v2M11 5.5c-1 4-3.5 7-6.5 8.5M6.5 9c1.2 2 3 3.6 5 4.5" />
    <path d="M12.5 20.5l4-9 4 9M14 17.5h5" />
  {:else if nombre === 'reloj'}
    <path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2" />
  {/if}
</svg>
