// El servicio de traducción de Tsuzuku: la sinopsis de un anime, en español.
//
// GET /api/sinopsis/<id>  →  { parrafos, fuente }
//
// Recibe solo el id del anime: la sinopsis la trae de AniList el propio servidor, así que nadie
// puede usarlo para traducir otros textos con la clave. Cada sinopsis se traduce una vez y se
// guarda en DATOS/sinopsis/<id>.json; de un anime que sigue emitiéndose se vuelve a mirar el
// original cada semana, por si AniList lo cambió. Un tope de caracteres al mes evita pasarse del
// cupo gratis de Google sin darse cuenta.
//
// Sin dependencias: Node 22 trae fetch, y lo demás es la biblioteca estándar.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { sinopsis } from '../src/lib/sinopsis.js'

const PUERTO = Number(process.env.PORT ?? 8080)
const DATOS = process.env.DATOS ?? './datos'
const CLAVE = process.env.GOOGLE_TRANSLATE_KEY ?? ''
const TOPE_MES = Number(process.env.TOPE_CARACTERES_MES ?? 450_000)
const REVISAR = 7 * 86400e3
// Traducciones nuevas por IP y por hora (lo ya traducido no cuenta).
const POR_IP = Number(process.env.NUEVAS_POR_IP_HORA ?? 60)
// El APK (https://localhost) y el servidor de desarrollo llaman desde otro origen.
const ORIGENES = new Set(['https://localhost', 'http://localhost:5180', 'http://localhost:4173'])

class Fallo extends Error {
  constructor(estado, mensaje) {
    super(mensaje)
    this.estado = estado
  }
}

// ——— Archivos ———

async function leerJson(ruta) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'))
  } catch {
    return null
  }
}

// Se escribe a un temporal y se renombra: un corte a la mitad no deja un JSON roto.
async function escribirJson(ruta, valor) {
  const tmp = `${ruta}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(valor))
  await rename(tmp, ruta)
}

const firma = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, 16)

// ——— AniList y Google ———

async function deAniList(id) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: 'query ($id: Int) { Media(id: $id, type: ANIME) { description(asHtml: false) status } }', variables: { id } }),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 404) throw new Fallo(404, 'AniList no tiene ese anime')
  if (!res.ok) throw new Fallo(502, `AniList respondió ${res.status}`)
  const media = (await res.json()).data?.Media
  if (!media) throw new Fallo(404, 'AniList no tiene ese anime')
  return media
}

const USO = () => join(DATOS, 'uso.json')
const mes = () => new Date().toISOString().slice(0, 7)

async function traducir(parrafos) {
  if (!CLAVE) throw new Fallo(503, 'Falta la clave de Google Translate')
  const caracteres = parrafos.reduce((n, p) => n + p.length, 0)
  const uso = (await leerJson(USO())) ?? {}
  const gastado = uso.mes === mes() ? uso.caracteres : 0
  if (gastado + caracteres > TOPE_MES) throw new Fallo(503, 'Se llegó al tope de traducciones del mes')

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(CLAVE)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: parrafos, source: 'en', target: 'es', format: 'text' }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    console.error(`Google respondió ${res.status}: ${detalle.slice(0, 300)}`)
    throw new Fallo(502, 'Google no pudo traducir')
  }
  const traducidos = (await res.json()).data.translations.map((t) => t.translatedText)
  await escribirJson(USO(), { mes: mes(), caracteres: gastado + caracteres })
  console.log(`traducidos ${caracteres} caracteres (${gastado + caracteres} este mes)`)
  return traducidos
}

// ——— La sinopsis traducida, con su copia guardada ———

const enCamino = new Map()

async function guardada(id) {
  return leerJson(join(DATOS, 'sinopsis', `${id}.json`))
}

async function traducida(id, alTraducir) {
  const ruta = join(DATOS, 'sinopsis', `${id}.json`)
  const g = await guardada(id)
  if (g && (g.terminado || Date.now() - g.revisada < REVISAR)) return g

  let media
  try {
    media = await deAniList(id)
  } catch (e) {
    if (g) return g // Si AniList no responde, sirve la copia aunque toque revisarla.
    throw e
  }
  const original = sinopsis(media.description)
  const f = firma(original.parrafos.join('\n'))
  const terminado = media.status === 'FINISHED' || media.status === 'CANCELLED'
  if (g && g.firma === f) {
    const al_dia = { ...g, revisada: Date.now(), terminado }
    await escribirJson(ruta, al_dia)
    return al_dia
  }
  if (!original.parrafos.length) return { parrafos: [], fuente: '' }

  alTraducir()
  const nueva = { id, parrafos: await traducir(original.parrafos), fuente: original.fuente, firma: f, terminado, revisada: Date.now(), traducida: new Date().toISOString() }
  await escribirJson(ruta, nueva)
  return nueva
}

// ——— Límite por IP para las traducciones nuevas ———

const porIp = new Map()

function contarNueva(ip) {
  const ahora = Date.now()
  const r = porIp.get(ip)
  if (!r || ahora - r.desde > 3600e3) porIp.set(ip, { desde: ahora, n: 1 })
  else if (++r.n > POR_IP) throw new Fallo(429, 'Demasiadas traducciones nuevas; prueba en un rato')
}

setInterval(() => {
  const limite = Date.now() - 3600e3
  for (const [ip, r] of porIp) if (r.desde < limite) porIp.delete(ip)
}, 600e3).unref()

// ——— HTTP ———

function responder(res, estado, cuerpo, cache) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache ?? 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(cuerpo))
}

const servidor = createServer(async (req, res) => {
  const origen = req.headers.origin
  if (origen && ORIGENES.has(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Vary', 'Origin')
  }
  const url = new URL(req.url ?? '/', 'http://local')
  if (req.method !== 'GET') return responder(res, 405, { error: 'Solo GET' })
  if (url.pathname === '/api/salud') return responder(res, 200, { ok: true, traduce: !!CLAVE })

  const m = url.pathname.match(/^\/api\/sinopsis\/(\d{1,7})$/)
  if (!m) return responder(res, 404, { error: 'No existe' })
  const id = Number(m[1])
  // La IP real la pone la recepción (Nginx Proxy Manager) y la pasa el nginx de la web.
  const ip = String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? '')

  try {
    let p = enCamino.get(id)
    if (!p) {
      p = traducida(id, () => contarNueva(ip)).finally(() => enCamino.delete(id))
      enCamino.set(id, p)
    }
    const d = await p
    responder(res, 200, { parrafos: d.parrafos, fuente: d.fuente }, 'public, max-age=86400')
  } catch (e) {
    const estado = e instanceof Fallo ? e.estado : 500
    if (estado === 500) console.error(e)
    responder(res, estado, { error: e instanceof Fallo ? e.message : 'Error interno' })
  }
})

await mkdir(join(DATOS, 'sinopsis'), { recursive: true })
servidor.listen(PUERTO, '0.0.0.0', () => console.log(`tsuzuku-api en :${PUERTO}${CLAVE ? '' : ' (sin clave de Google: no traduce)'}`))

process.on('SIGTERM', () => servidor.close(() => process.exit(0)))
