// La sinopsis de AniList viene en inglés y con algo de HTML (<br>, <i>), marcas de spoiler (~!…!~)
// y a veces la fuente al final, "(Source: Crunchyroll)". Esto la pasa a párrafos de texto plano.
// Lo usan la app y el servicio de traducción (servidor/), así que es JavaScript sin dependencias.

/** @type {Record<string, string>} */
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }

/** @param {string} s */
function decodificar(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, /** @type {string} */ e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTIDADES[e.toLowerCase()] ?? m
  })
}

/**
 * @param {string | null | undefined} descripcion
 * @returns {{ parrafos: string[], fuente: string }}
 */
export function sinopsis(descripcion) {
  if (!descripcion) return { parrafos: [], fuente: '' }
  let t = descripcion
    .replace(/~!([\s\S]*?)!~/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
  t = decodificar(t)
  let fuente = ''
  t = t.replace(/\(\s*(?:Source|Fuente)\s*:\s*([^)]+)\)\s*$/i, (_, /** @type {string} */ f) => {
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
