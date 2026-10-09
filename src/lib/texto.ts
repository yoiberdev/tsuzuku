// La sinopsis de AniList viene en inglés y con algo de HTML (<br>, <i>), marcas de spoiler
// (~!…!~) y a veces la fuente al final, "(Source: Crunchyroll)". Aquí se pasa a párrafos de texto
// plano: nada se inserta como HTML.

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }

function decodificar(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTIDADES[e.toLowerCase()] ?? m
  })
}

export function sinopsis(descripcion: string | null): { parrafos: string[]; fuente: string } {
  if (!descripcion) return { parrafos: [], fuente: '' }
  let t = descripcion
    .replace(/~!([\s\S]*?)!~/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
  t = decodificar(t)
  let fuente = ''
  t = t.replace(/\(\s*(?:Source|Fuente)\s*:\s*([^)]+)\)\s*$/i, (_, f: string) => {
    fuente = f.trim()
    return ''
  })
  t = t.replace(/\[Written by MAL Rewrite\]\s*$/i, () => {
    fuente = 'MAL Rewrite'
    return ''
  })
  const parrafos = t
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return { parrafos, fuente }
}

// Chrome trae un traductor en el propio navegador (sin mandar el texto a ningún servidor). Donde
// existe, la sinopsis se puede pasar al español; donde no, se queda en inglés.
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
