// La sinopsis: limpiarla (sinopsis.js, compartido con el servidor) y conseguirla en español.

export { sinopsis } from './sinopsis.js'

export interface Traducida {
  parrafos: string[]
  fuente: string
}

// El servicio de traducción vive junto a la web, en anime.yoiber.dev/api. Desde la propia web se
// llama con una ruta relativa; desde el APK (o en desarrollo), con la dirección completa.
const API = location.hostname === 'anime.yoiber.dev' ? '' : 'https://anime.yoiber.dev'
const PREFIJO = 'tsuzuku.es.'
const VIGENCIA = 30 * 86400e3

/**
 * La sinopsis traducida al español por el servidor, o null si no se puede (sin conexión, sin clave
 * de traducción o con el cupo del mes gastado). Se guarda en el dispositivo un mes.
 */
export async function sinopsisEnEspañol(id: number): Promise<Traducida | null> {
  try {
    const g = JSON.parse(localStorage.getItem(PREFIJO + id) ?? 'null') as { t: number; d: Traducida } | null
    if (g && Date.now() - g.t < VIGENCIA) return g.d
  } catch {
    // Se pide de nuevo.
  }
  try {
    const res = await fetch(`${API}/api/sinopsis/${id}`, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const d = (await res.json()) as Traducida
    if (!d.parrafos?.length) return null
    try {
      localStorage.setItem(PREFIJO + id, JSON.stringify({ t: Date.now(), d }))
    } catch {
      // Sin espacio se queda sin guardar.
    }
    return d
  } catch {
    return null
  }
}

// Chrome trae un traductor en el propio navegador (sin mandar el texto a ningún servidor). Queda
// como respaldo para cuando el servicio no puede traducir.
interface Traductor {
  translate(texto: string): Promise<string>
}
interface ApiTraductor {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<Traductor>
}

const api = () => (globalThis as unknown as { Translator?: ApiTraductor }).Translator

export const puedeTraducir = () => !!api()

let traductor: Promise<Traductor> | null = null

export async function traducir(parrafos: string[]) {
  const T = api()
  if (!T) throw new Error('Este navegador no traduce.')
  const par = { sourceLanguage: 'en', targetLanguage: 'es' }
  if ((await T.availability(par)) === 'unavailable') throw new Error('El traductor del navegador no tiene inglés → español.')
  traductor ??= T.create(par).catch((e) => {
    traductor = null
    throw e
  })
  const t = await traductor
  return Promise.all(parrafos.map((p) => t.translate(p)))
}
