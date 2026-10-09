// Lo que llega de AniList (solo los campos que se piden) y lo que guarda la app.

export interface Titulo {
  romaji: string
  english: string | null
  native: string | null
}

export interface Emision {
  episode: number
  airingAt: number // segundos
}

/** Lo justo para dibujar un anime en una cuadrícula o en una fila. */
export interface Tarjeta {
  id: number
  title: Titulo
  coverImage: { large: string; extraLarge?: string; color: string | null }
  format: string | null
  episodes: number | null
  status: string | null
  averageScore: number | null
  genres: string[]
  season: string | null
  seasonYear: number | null
  nextAiringEpisode: Emision | null
  studios?: { nodes: { name: string }[] }
}

export interface Enlace {
  site: string
  url: string
  type: string | null
  language: string | null
  color: string | null
  icon: string | null
  isDisabled: boolean | null
}

export interface Fecha {
  year: number | null
  month: number | null
  day: number | null
}

export interface Detalle extends Tarjeta {
  idMal: number | null
  bannerImage: string | null
  description: string | null
  duration: number | null
  source: string | null
  popularity: number | null
  startDate: Fecha
  endDate: Fecha
  siteUrl: string
  trailer: { id: string; site: string; thumbnail: string | null } | null
  externalLinks: Enlace[]
  airingSchedule: { nodes: Emision[] }
  relations: { edges: { relationType: string; node: Tarjeta & { type: string } }[] }
  recommendations: { nodes: { mediaRecommendation: Tarjeta | null }[] }
  characters: {
    edges: {
      role: string
      node: { id: number; name: { full: string }; image: { medium: string | null } }
      voiceActors: { name: { full: string } }[]
    }[]
  }
}

export interface EnCalendario {
  id: number
  episode: number
  airingAt: number
  media: Tarjeta & { isAdult: boolean; countryOfOrigin: string | null }
}

/** Lo que trae la lista para actualizarse y programar los avisos. */
export interface AlDia extends Tarjeta {
  airingSchedule: { nodes: Emision[] }
}

export type Estado = 'viendo' | 'pendiente' | 'pausado' | 'terminado' | 'abandonado'

export interface Entrada {
  id: number
  estado: Estado
  progreso: number
  agregado: number // ms
  actualizado: number // ms
  /** Copia del anime para mostrar la lista sin pedirle nada a AniList. */
  anime: Tarjeta
  /** Los próximos episodios conocidos, para los avisos. */
  proximos?: Emision[]
}
