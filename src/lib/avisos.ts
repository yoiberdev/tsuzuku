import { Capacitor } from '@capacitor/core'
// El plugin va importado tal cual: no se puede devolver desde una promesa, porque Capacitor lo
// envuelve en un proxy que responde a cualquier método, `then` incluido.
import { LocalNotifications as ln } from '@capacitor/local-notifications'
import { titulo, type Idioma } from './formato'
import type { Entrada } from './tipos'

// Avisos de estreno, solo en la app de Android: se programan en el teléfono con la hora de cada
// episodio que AniList ya conoce, sin servidor. Como AniList solo sabe las fechas de unas semanas
// hacia adelante, se vuelven a programar cada vez que la lista se pone al día.
export const nativa = Capacitor.isNativePlatform()

const CANAL = 'estrenos'
const DIAS = 21
const MAXIMO = 60

export async function permisoAvisos(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!nativa) return 'denied'
  const p = await ln.checkPermissions()
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'
}

export async function pedirPermisoAvisos() {
  if (!nativa) return false
  return (await ln.requestPermissions()).display === 'granted'
}

/** Al tocar un aviso, abre la ficha de ese anime. */
export async function alTocarAviso(abrir: (id: number) => void) {
  if (!nativa) return
  await ln.createChannel({ id: CANAL, name: 'Estrenos', description: 'Cuando sale un episodio de lo que estás viendo.', importance: 4 })
  await ln.addListener('localNotificationActionPerformed', (a) => {
    const id = Number(a.notification.extra?.anime)
    if (id) abrir(id)
  })
}

export async function programarAvisos(entradas: Entrada[], idioma: Idioma, activos: boolean) {
  if (!nativa) return 0
  const pendientes = await ln.getPending()
  if (pendientes.notifications.length) await ln.cancel({ notifications: pendientes.notifications.map((n) => ({ id: n.id })) })
  if (!activos || (await ln.checkPermissions()).display !== 'granted') return 0

  const ahora = Date.now() / 1000
  const items = entradas
    .filter((e) => e.estado === 'viendo')
    .flatMap((e) => (e.proximos ?? []).map((p) => ({ e, p })))
    .filter(({ p }) => p.airingAt > ahora + 60 && p.airingAt < ahora + DIAS * 86400)
    .sort((a, b) => a.p.airingAt - b.p.airingAt)
    .slice(0, MAXIMO)

  if (!items.length) return 0
  await ln.schedule({
    notifications: items.map(({ e, p }) => ({
      // Un id por anime y episodio, que entre en un entero de 32 bits.
      id: e.id * 1000 + (p.episode % 1000),
      title: `${titulo(e.anime.title, idioma)} · episodio ${p.episode}`,
      body: 'Se acaba de emitir en Japón. Toca para ver dónde verlo.',
      schedule: { at: new Date(p.airingAt * 1000), allowWhileIdle: true },
      channelId: CANAL,
      smallIcon: 'ic_aviso',
      extra: { anime: e.id },
    })),
  })
  return items.length
}
