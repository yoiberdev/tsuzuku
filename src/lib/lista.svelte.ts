import { alDia } from './anilist'
import { emitidos } from './formato'
import type { AlDia, Entrada, Estado, Tarjeta } from './tipos'

// Tu lista vive en el dispositivo (localStorage). Cada entrada guarda una copia del anime para
// mostrarse sin conexión; `actualizar()` la pone al día con AniList.
const CLAVE = 'tsuzuku.lista'

function cargar(): Record<number, Entrada> {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) ?? '{}')
    return d && typeof d === 'object' ? d : {}
  } catch {
    return {}
  }
}

export const lista = $state<{ entradas: Record<number, Entrada>; revisada: number }>({ entradas: cargar(), revisada: 0 })

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista.entradas))
  } catch {
    // Sin espacio no hay mucho que hacer: el caché ya se limpia solo en anilist.ts.
  }
}

// Solo lo necesario de la tarjeta, para que la lista no crezca de más.
function copia(a: Tarjeta): Tarjeta {
  const { id, title, coverImage, format, episodes, status, averageScore, genres, season, seasonYear, nextAiringEpisode, studios } = a
  return {
    id,
    title,
    coverImage: { large: coverImage.large, color: coverImage.color },
    format,
    episodes,
    status,
    averageScore,
    genres,
    season,
    seasonYear,
    nextAiringEpisode,
    ...(studios ? { studios } : {}),
  }
}

export const entrada = (id: number): Entrada | undefined => lista.entradas[id]

/** Hasta dónde se puede marcar como visto: lo que ya salió o, si no se sabe, el total. */
export const tope = (a: Tarjeta) => emitidos(a) ?? a.episodes ?? Infinity

export function poner(a: Tarjeta, estado: Estado) {
  const ahora = Date.now()
  const e = lista.entradas[a.id]
  let progreso = e?.progreso ?? 0
  if (estado === 'terminado' && a.episodes) progreso = a.episodes
  // Desde la ficha llegan también los próximos estrenos: así los avisos no esperan a la próxima
  // actualización de la lista.
  const proximos = (a as Partial<AlDia>).airingSchedule?.nodes ?? e?.proximos
  lista.entradas[a.id] = { id: a.id, estado, progreso, agregado: e?.agregado ?? ahora, actualizado: ahora, anime: copia(a), proximos }
  guardar()
}

export function quitar(id: number) {
  delete lista.entradas[id]
  guardar()
}

/**
 * Suma (o resta) episodios vistos. Devuelve 'terminado' si con eso acabaste un anime que ya
 * terminó de emitirse, y entonces pasa a terminados.
 */
export function avanzar(id: number, paso = 1): 'terminado' | null {
  const e = lista.entradas[id]
  if (!e) return null
  e.progreso = Math.max(0, Math.min(Math.max(tope(e.anime), e.progreso), e.progreso + paso))
  e.actualizado = Date.now()
  if (paso > 0 && e.estado === 'pendiente') e.estado = 'viendo'
  let fin: 'terminado' | null = null
  if (e.anime.episodes && e.progreso >= e.anime.episodes && e.anime.status === 'FINISHED' && e.estado !== 'terminado') {
    e.estado = 'terminado'
    fin = 'terminado'
  }
  guardar()
  return fin
}

export function fijarProgreso(id: number, n: number) {
  const e = lista.entradas[id]
  if (!e) return
  e.progreso = Math.max(0, Math.round(n))
  e.actualizado = Date.now()
  guardar()
}

/** Episodios ya emitidos que todavía no viste. */
export function porVer(e: Entrada) {
  const n = emitidos(e.anime)
  return n == null ? 0 : Math.max(0, n - e.progreso)
}

export const entradas = () => Object.values(lista.entradas)
export const cuantos = (estado: Estado) => entradas().filter((e) => e.estado === estado).length

/**
 * Trae de AniList cómo van los animes que sigues (los que no están terminados ni abandonados):
 * episodios emitidos, estado y próximos estrenos.
 */
export async function actualizar() {
  const ids = entradas()
    .filter((e) => e.estado !== 'terminado' && e.estado !== 'abandonado')
    .map((e) => e.id)
  const nuevos: AlDia[] = []
  for (let i = 0; i < ids.length; i += 50) nuevos.push(...(await alDia(ids.slice(i, i + 50))).Page.media)
  for (const a of nuevos) {
    const e = lista.entradas[a.id]
    if (!e) continue
    e.anime = copia(a)
    e.proximos = a.airingSchedule.nodes
  }
  lista.revisada = Date.now()
  guardar()
}

// ——— Respaldo e importación ———

const DE_ANILIST: Record<string, Estado> = {
  CURRENT: 'viendo',
  REPEATING: 'viendo',
  PLANNING: 'pendiente',
  PAUSED: 'pausado',
  COMPLETED: 'terminado',
  DROPPED: 'abandonado',
}

/** Suma a la lista lo de AniList. Lo que ya tenías no se pisa. Devuelve cuántos se agregaron. */
export function importar(items: { status: string; progress: number | null; media: Tarjeta }[]) {
  let n = 0
  const ahora = Date.now()
  for (const it of items) {
    if (lista.entradas[it.media.id]) continue
    lista.entradas[it.media.id] = {
      id: it.media.id,
      estado: DE_ANILIST[it.status] ?? 'pendiente',
      progreso: it.progress ?? 0,
      agregado: ahora,
      actualizado: ahora,
      anime: copia(it.media),
    }
    n++
  }
  guardar()
  return n
}

export function respaldo() {
  return JSON.stringify({ app: 'tsuzuku', version: 1, fecha: new Date().toISOString(), entradas: Object.values(lista.entradas) }, null, 1)
}

/** Lee un respaldo. Lo del archivo gana si es más reciente que lo que hay. */
export function restaurar(texto: string) {
  const d = JSON.parse(texto) as { app?: string; entradas?: Entrada[] }
  if (d.app !== 'tsuzuku' || !Array.isArray(d.entradas)) throw new Error('Ese archivo no es un respaldo de Tsuzuku.')
  let n = 0
  for (const e of d.entradas) {
    if (!e?.id || !e.anime?.title) continue
    const ya = lista.entradas[e.id]
    if (!ya || ya.actualizado < e.actualizado) {
      lista.entradas[e.id] = e
      n++
    }
  }
  guardar()
  return n
}

export function vaciar() {
  lista.entradas = {}
  guardar()
}
