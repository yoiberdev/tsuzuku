import type { AlDia, Detalle, EnCalendario, Tarjeta } from './tipos'

// Todo sale de la API pública de AniList (GraphQL, sin clave). Permite 30 consultas por minuto,
// así que cada respuesta se guarda un rato: en memoria y en localStorage, que además sirve para
// ver lo último que se cargó sin conexión.
const API = 'https://graphql.anilist.co'
const MIN = 60e3
const PREFIJO = 'tsuzuku.c.'

const TARJETA = `
  id
  title { romaji english native }
  coverImage { large extraLarge color }
  format episodes status averageScore genres season seasonYear
  nextAiringEpisode { episode airingAt }
`
// Nada para adultos, y sin videos musicales.
const FORMATOS = '[TV, TV_SHORT, MOVIE, SPECIAL, OVA, ONA]'

export class ErrorAniList extends Error {
  constructor(
    message: string,
    readonly estado = 0,
  ) {
    super(message)
  }
}

type Guardado = { t: number; d: unknown }
const memoria = new Map<string, Guardado>()
const enCamino = new Map<string, Promise<unknown>>()

// Lo que queda del cupo de consultas, según las cabeceras de la última respuesta.
let restantes = 30
let reinicio = 0

function hash(texto: string) {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    a = Math.imul(a ^ c, 2654435761)
    b = Math.imul(b ^ c, 1597334677)
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}

function leerGuardado(clave: string): Guardado | null {
  const m = memoria.get(clave)
  if (m) return m
  try {
    const g = JSON.parse(localStorage.getItem(PREFIJO + clave) ?? 'null') as Guardado | null
    if (g) memoria.set(clave, g)
    return g
  } catch {
    return null
  }
}

function guardar(clave: string, d: unknown) {
  const g = { t: Date.now(), d }
  memoria.set(clave, g)
  const texto = JSON.stringify(g)
  try {
    localStorage.setItem(PREFIJO + clave, texto)
  } catch {
    // Lleno: se borra el caché viejo y se intenta otra vez. La lista no se toca.
    limpiarCache(true)
    try {
      localStorage.setItem(PREFIJO + clave, texto)
    } catch {
      // Sin espacio se queda solo en memoria.
    }
  }
}

/** Borra las respuestas guardadas. Con `soloViejas`, las de más de un día. */
export function limpiarCache(soloViejas = false) {
  const limite = Date.now() - 24 * 60 * MIN
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(PREFIJO)) continue
    if (!soloViejas) localStorage.removeItem(k)
    else {
      try {
        if ((JSON.parse(localStorage.getItem(k) ?? '{}') as Guardado).t < limite) localStorage.removeItem(k)
      } catch {
        localStorage.removeItem(k)
      }
    }
  }
  if (!soloViejas) memoria.clear()
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pedir<T>(query: string, variables: Record<string, unknown>, intento = 0): Promise<T> {
  if (restantes <= 1 && Date.now() < reinicio) await esperar(reinicio - Date.now() + 250)
  let res: Response
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new ErrorAniList('Sin conexión con AniList.')
  }
  const quedan = Number(res.headers.get('X-RateLimit-Remaining'))
  if (Number.isFinite(quedan) && res.headers.has('X-RateLimit-Remaining')) restantes = quedan
  const reset = Number(res.headers.get('X-RateLimit-Reset'))
  if (reset) reinicio = reset * 1000

  if (res.status === 429 && intento < 2) {
    restantes = 0
    reinicio = Math.max(reinicio, Date.now() + 20e3)
    return pedir<T>(query, variables, intento + 1)
  }
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string; status?: number }[] } | null
  if (!res.ok || !json?.data) {
    const e = json?.errors?.[0]
    if (res.status === 404 || e?.status === 404) throw new ErrorAniList('AniList no tiene eso.', 404)
    if (res.status === 429) throw new ErrorAniList('AniList pide esperar un minuto antes de seguir.', 429)
    throw new ErrorAniList(e?.message ? `AniList respondió: ${e.message}` : `AniList respondió ${res.status}.`, res.status)
  }
  return json.data
}

/**
 * Una consulta con caché. Si la copia guardada tiene menos de `vigencia` ms, ni se pregunta; si
 * AniList no responde, se usa la copia aunque sea vieja.
 */
async function consulta<T>(query: string, variables: Record<string, unknown>, vigencia: number): Promise<T> {
  const clave = hash(query + JSON.stringify(variables))
  const g = leerGuardado(clave)
  if (g && Date.now() - g.t < vigencia) return g.d as T
  const ya = enCamino.get(clave)
  if (ya) return ya as Promise<T>
  const p = pedir<T>(query, variables)
    .then((d) => {
      guardar(clave, d)
      return d
    })
    .catch((e) => {
      if (g && (e as ErrorAniList).estado !== 404) return g.d as T
      throw e
    })
    .finally(() => enCamino.delete(clave))
  enCamino.set(clave, p)
  return p
}

type Pagina<K extends string, T> = { Page: { pageInfo: { hasNextPage: boolean } } & Record<K, T[]> }

export const temporada = (season: string, seasonYear: number, page = 1) =>
  consulta<Pagina<'media', Tarjeta>>(
    `query ($season: MediaSeason, $seasonYear: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, format_in: ${FORMATOS}, sort: [POPULARITY_DESC]) {
          ${TARJETA}
          studios(isMain: true) { nodes { name } }
        }
      }
    }`,
    { season, seasonYear, page },
    60 * MIN,
  )

/** Los episodios que se emiten entre `desde` y `hasta` (segundos). */
export const calendario = (desde: number, hasta: number, page = 1) =>
  consulta<Pagina<'airingSchedules', EnCalendario>>(
    `query ($desde: Int, $hasta: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $desde, airingAt_lesser: $hasta, sort: [TIME]) {
          id episode airingAt
          media { ${TARJETA} isAdult countryOfOrigin }
        }
      }
    }`,
    { desde, hasta, page },
    30 * MIN,
  )

export const buscar = ({ texto = '', genero = '', page = 1 }: { texto?: string; genero?: string; page?: number }) =>
  consulta<Pagina<'media', Tarjeta>>(
    `query ($search: String, $genre: String, $page: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: 30) {
        pageInfo { hasNextPage }
        media(search: $search, genre: $genre, type: ANIME, isAdult: false, format_in: ${FORMATOS}, sort: $sort) {
          ${TARJETA}
          studios(isMain: true) { nodes { name } }
        }
      }
    }`,
    {
      search: texto || undefined,
      genre: genero || undefined,
      page,
      // Sin texto: lo que más se está viendo ahora (o, con género, lo más popular de ese género).
      sort: texto ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : genero ? ['POPULARITY_DESC'] : ['TRENDING_DESC', 'POPULARITY_DESC'],
    },
    60 * MIN,
  )

export const anime = (id: number) =>
  consulta<{ Media: Detalle }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${TARJETA}
        idMal bannerImage description(asHtml: false) duration source popularity siteUrl
        startDate { year month day }
        endDate { year month day }
        studios(isMain: true) { nodes { name } }
        trailer { id site thumbnail }
        externalLinks { site url type language color icon isDisabled }
        airingSchedule(notYetAired: true, perPage: 6) { nodes { episode airingAt } }
        relations { edges { relationType node { ${TARJETA} type } } }
        recommendations(perPage: 10, sort: [RATING_DESC]) { nodes { mediaRecommendation { ${TARJETA} } } }
        characters(perPage: 10, sort: [ROLE, RELEVANCE, ID]) {
          edges { role node { id name { full } image { medium } } voiceActors(language: JAPANESE, sort: [RELEVANCE]) { name { full } } }
        }
      }
    }`,
    { id },
    30 * MIN,
  )

/** Cómo van los animes de la lista: episodios, estado y los próximos estrenos. */
export const alDia = (ids: number[]) =>
  consulta<Pagina<'media', AlDia>>(
    `query ($ids: [Int]) {
      Page(perPage: 50) {
        pageInfo { hasNextPage }
        media(id_in: $ids, type: ANIME) {
          ${TARJETA}
          airingSchedule(notYetAired: true, perPage: 8) { nodes { episode airingAt } }
        }
      }
    }`,
    { ids },
    5 * MIN,
  )

export interface EntradaAniList {
  status: string
  progress: number | null
  media: Tarjeta
}

/** La lista pública de una cuenta de AniList. */
export const listaDeAniList = (userName: string) =>
  pedir<{ MediaListCollection: { lists: { entries: EntradaAniList[] }[] } }>(
    `query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists { entries { status progress media { ${TARJETA} } } }
      }
    }`,
    { userName },
  )
