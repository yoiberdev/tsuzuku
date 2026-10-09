import type { Idioma } from './formato'

// Lo que no es la lista: preferencias, la navegación y los avisos en pantalla.

// ——— Preferencias ———

const CLAVE = 'tsuzuku.ajustes'

interface Ajustes {
  idioma: Idioma
  avisos: boolean
  sinopsisEs: boolean
}

function cargar(): Ajustes {
  const base: Ajustes = { idioma: 'romaji', avisos: true, sinopsisEs: true }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') }
  } catch {
    return base
  }
}

export const ajustes = $state<Ajustes>(cargar())

/** Sube cuando Android da el permiso de avisos, para volver a programarlos en ese momento. */
export const permisos = $state({ avisos: 0 })

export function guardarAjustes() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ajustes))
  } catch {
    // Se quedan para esta sesión.
  }
}

// ——— Navegación ———
// Con el hash de la dirección: #/lista, #/calendario, #/temporada, #/buscar, #/ajustes y
// #/anime/123. La ficha de un anime se abre encima de la pestaña en la que estabas, que sigue
// montada debajo con su scroll.

export const PESTAÑAS = ['lista', 'calendario', 'temporada', 'buscar'] as const
export type Pestaña = (typeof PESTAÑAS)[number] | 'ajustes'

export const ruta = $state<{ pestaña: Pestaña; anime: number | null; genero: string }>({ pestaña: 'lista', anime: null, genero: '' })

function leer() {
  const [, a, b] = location.hash.replace(/^#/, '').split('/')
  if (a === 'anime' && Number(b)) {
    ruta.anime = Number(b)
    return
  }
  ruta.anime = null
  if ((PESTAÑAS as readonly string[]).includes(a) || a === 'ajustes') ruta.pestaña = a as Pestaña
  if (a === 'buscar') ruta.genero = b ? decodeURIComponent(b) : ''
}

export function iniciarRuta(inicial: Pestaña) {
  if (!location.hash) history.replaceState(null, '', `#/${inicial}`)
  leer()
  addEventListener('hashchange', leer)
}

// Cuántas fichas (o ajustes) se abrieron desde la app: si entraste directo con un enlace a una
// ficha, cerrarla no puede ser `history.back()`, que te sacaría de la página.
let abiertas = 0

/** Cambiar de pestaña no agrega pasos al historial: «atrás» cierra fichas, no recorre pestañas. */
export function pestaña(p: Pestaña, genero = '') {
  history.replaceState(null, '', `#/${p}${genero ? `/${encodeURIComponent(genero)}` : ''}`)
  leer()
}

export function abrirAnime(id: number) {
  abiertas++
  location.hash = `/anime/${id}`
}

export function abrirAjustes() {
  abiertas++
  location.hash = '/ajustes'
}

/** Atrás: cierra la ficha o los ajustes. Devuelve false si ya no hay adónde volver. */
export function volver() {
  if (ruta.anime == null && ruta.pestaña !== 'ajustes') return false
  if (abiertas > 0) {
    abiertas--
    history.back()
  } else pestaña(ruta.pestaña === 'ajustes' ? 'lista' : ruta.pestaña)
  return true
}

// ——— Avisos en pantalla ———

export const toast = $state<{ texto: string; n: number }>({ texto: '', n: 0 })
let reloj: ReturnType<typeof setTimeout> | undefined

export function avisar(texto: string) {
  toast.texto = texto
  toast.n++
  clearTimeout(reloj)
  reloj = setTimeout(() => (toast.texto = ''), 3200)
}
