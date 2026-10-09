import type { Emision, Estado, Fecha, Tarjeta, Titulo } from './tipos'

// AniList viene en inglés: esto lo pasa a español.

export const GENEROS: Record<string, string> = {
  Action: 'Acción',
  Adventure: 'Aventura',
  Comedy: 'Comedia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasía',
  Horror: 'Terror',
  'Mahou Shoujo': 'Mahō shōjo',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Misterio',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ciencia ficción',
  'Slice of Life': 'Vida cotidiana',
  Sports: 'Deportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspenso',
}
export const genero = (g: string) => GENEROS[g] ?? g

const FORMATOS: Record<string, string> = {
  TV: 'Serie',
  TV_SHORT: 'Serie corta',
  MOVIE: 'Película',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Video musical',
}
export const formato = (f: string | null) => (f ? (FORMATOS[f] ?? f) : '')

const EMISION: Record<string, string> = {
  FINISHED: 'Terminado',
  RELEASING: 'En emisión',
  NOT_YET_RELEASED: 'Próximamente',
  CANCELLED: 'Cancelado',
  HIATUS: 'En pausa',
}
export const emision = (s: string | null) => (s ? (EMISION[s] ?? s) : '')

export const TEMPORADAS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const
export type Temporada = (typeof TEMPORADAS)[number]
const NOMBRE_TEMPORADA: Record<string, string> = { WINTER: 'Invierno', SPRING: 'Primavera', SUMMER: 'Verano', FALL: 'Otoño' }
// Las temporadas son las de Japón; en el hemisferio sur no coinciden, así que van con sus meses.
const MESES_TEMPORADA: Record<string, string> = { WINTER: 'ene · feb · mar', SPRING: 'abr · may · jun', SUMMER: 'jul · ago · sep', FALL: 'oct · nov · dic' }
export const temporadaNombre = (s: string | null) => (s ? (NOMBRE_TEMPORADA[s] ?? s) : '')
export const temporadaMeses = (s: string) => MESES_TEMPORADA[s] ?? ''

export function temporadaDe(fecha = new Date()): { season: Temporada; year: number } {
  return { season: TEMPORADAS[Math.floor(fecha.getMonth() / 3)], year: fecha.getFullYear() }
}

export function moverTemporada(t: { season: Temporada; year: number }, paso: number) {
  const i = TEMPORADAS.indexOf(t.season) + paso
  return { season: TEMPORADAS[((i % 4) + 4) % 4], year: t.year + Math.floor(i / 4) }
}

const RELACIONES: Record<string, string> = {
  PREQUEL: 'Precuela',
  SEQUEL: 'Secuela',
  PARENT: 'Historia principal',
  SIDE_STORY: 'Historia paralela',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Otra versión',
  ADAPTATION: 'Adaptación',
  SOURCE: 'Obra original',
  SUMMARY: 'Resumen',
  CHARACTER: 'Mismos personajes',
  COMPILATION: 'Recopilación',
  CONTAINS: 'Incluye',
  OTHER: 'Relacionado',
}
export const relacion = (r: string) => RELACIONES[r] ?? r

const FUENTES: Record<string, string> = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Novela ligera',
  VISUAL_NOVEL: 'Novela visual',
  VIDEO_GAME: 'Videojuego',
  WEB_NOVEL: 'Novela web',
  NOVEL: 'Novela',
  ANIME: 'Anime',
  DOUJINSHI: 'Doujinshi',
  MULTIMEDIA_PROJECT: 'Proyecto multimedia',
  PICTURE_BOOK: 'Libro ilustrado',
  GAME: 'Juego',
  COMIC: 'Cómic',
  LIVE_ACTION: 'Live action',
  OTHER: 'Otra',
}
export const fuente = (s: string | null) => (s ? (FUENTES[s] ?? s) : '')

export const ESTADOS: { id: Estado; nombre: string; corto: string }[] = [
  { id: 'viendo', nombre: 'Viendo', corto: 'Viendo' },
  { id: 'pendiente', nombre: 'Por ver', corto: 'Por ver' },
  { id: 'pausado', nombre: 'En pausa', corto: 'Pausa' },
  { id: 'terminado', nombre: 'Terminados', corto: 'Visto' },
  { id: 'abandonado', nombre: 'Abandonados', corto: 'Dejado' },
]
export const nombreEstado = (e: Estado) => ESTADOS.find((x) => x.id === e)?.corto ?? e

// ——— Títulos ———

export type Idioma = 'romaji' | 'english' | 'native'

export function titulo(t: Titulo, idioma: Idioma) {
  return (idioma === 'english' ? t.english : idioma === 'native' ? t.native : null) || t.romaji || t.english || t.native || ''
}

/** El otro título, para mostrarlo debajo, si dice algo distinto. */
export function otroTitulo(t: Titulo, idioma: Idioma) {
  const principal = titulo(t, idioma)
  const otro = idioma === 'romaji' ? t.english : t.romaji
  return otro && otro.toLowerCase() !== principal.toLowerCase() ? otro : ''
}

// ——— Episodios ———

/** Cuántos episodios ya se emitieron, si se sabe. */
export function emitidos(a: Pick<Tarjeta, 'status' | 'episodes' | 'nextAiringEpisode'>): number | null {
  if (a.nextAiringEpisode) return a.nextAiringEpisode.episode - 1
  if (a.status === 'FINISHED') return a.episodes
  if (a.status === 'NOT_YET_RELEASED') return 0
  return null
}

// ——— Fechas y horas ———

const hora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false })
const diaSemana = new Intl.DateTimeFormat('es', { weekday: 'long' })
const diaCorto = new Intl.DateTimeFormat('es', { weekday: 'short' })
const diaMes = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const fechaLarga = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

export const horaDe = (segundos: number) => hora.format(segundos * 1000)
export const diaDe = (fecha: Date) => diaSemana.format(fecha)
export const diaCortoDe = (fecha: Date) => diaCorto.format(fecha).replace('.', '')
export const diaMesDe = (fecha: Date) => diaMes.format(fecha).replace('.', '')

export function inicioDelDia(fecha = new Date()) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

/** "hoy", "mañana", "el sábado" o "el 18 oct". */
export function cuando(segundos: number, ahora = Date.now()) {
  const d = new Date(segundos * 1000)
  const dias = Math.round((inicioDelDia(d).getTime() - inicioDelDia(new Date(ahora)).getTime()) / 86400e3)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias === -1) return 'ayer'
  if (dias > 1 && dias < 7) return `el ${diaDe(d)}`
  return `el ${diaMesDe(d)}`
}

/** Lo que falta: "2 d 4 h", "3 h 12 min", "5 min". Vacío si ya pasó. */
export function falta(segundos: number, ahora = Date.now()) {
  const s = Math.round(segundos - ahora / 1000)
  if (s <= 0) return ''
  if (s < 60) return '1 min'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  return `${m} min`
}

export function proximo(e: Emision, ahora = Date.now()) {
  return `Ep ${e.episode} · ${cuando(e.airingAt, ahora)} ${horaDe(e.airingAt)}`
}

export function fecha(f: Fecha | null) {
  if (!f?.year) return ''
  if (!f.month) return String(f.year)
  if (!f.day) return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(f.year, f.month - 1))
  return fechaLarga.format(new Date(f.year, f.month - 1, f.day))
}

export const nota = (n: number | null) => (n == null ? '' : String(n))
