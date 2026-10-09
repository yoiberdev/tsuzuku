# Cómo funciona Tsuzuku

## Los datos: AniList

Todo sale de la API GraphQL pública de AniList (`graphql.anilist.co`), que no pide clave ni cuenta.
Cada pantalla hace una sola consulta con los campos que necesita: la temporada pide 50 animes por
página con lo justo para una tarjeta, y la ficha pide de una vez el detalle, los próximos episodios,
las plataformas, los relacionados, los personajes y las recomendaciones.

AniList permite 30 consultas por minuto, así que `src/lib/anilist.ts` guarda cada respuesta en
memoria y en `localStorage`, con una vigencia según lo que sea: una hora la temporada y las
búsquedas, media hora el calendario y las fichas, cinco minutos el estado de tu lista. Dos pantallas
que piden lo mismo a la vez comparten la misma consulta. Las cabeceras `X-RateLimit-Remaining` y
`X-RateLimit-Reset` dicen cuánto cupo queda; si se acaba, la siguiente consulta espera al reinicio,
y si AniList responde 429 se reintenta hasta dos veces. Cuando no hay conexión, se usa la última copia
guardada aunque esté vencida, así que lo que ya viste se sigue viendo.

Las respuestas guardadas llevan un prefijo propio. Si `localStorage` se llena, se borran las de más
de un día y se intenta otra vez; la lista nunca se toca.

## La lista

La lista vive en el dispositivo, en `localStorage`. Cada entrada guarda el estado (viendo, por ver,
en pausa, terminado o abandonado), los episodios vistos y una copia reducida del anime, para que
«Mi lista» se dibuje sin conexión y sin consultas.

Al abrir la app, y cada vez que vuelve a primer plano si pasaron diez minutos, `actualizar()` pide a
AniList cómo van los animes que no están terminados ni abandonados, de 50 en 50: episodios
emitidos, estado y los próximos ocho estrenos. Con eso se calcula lo que tienes por ver: los
episodios emitidos menos los vistos. AniList no da el número emitido directamente; sale del
próximo episodio (si el próximo es el 7, salieron 6) o, si ya terminó, del total.

El «+1» no deja pasar de lo emitido, y cuando completas un anime que ya terminó de emitirse pasa
solo a «Terminados».

Traer la lista de AniList usa `MediaListCollection` con el nombre de usuario, que funciona sin
iniciar sesión si la lista es pública. Los estados de AniList se traducen a los de aquí (`CURRENT`
y `REPEATING` a «viendo», `PLANNING` a «por ver», etc.) y lo que ya tenías no se pisa. El respaldo
es un JSON con todas las entradas; al abrirlo, gana la versión más reciente de cada una.

## Los avisos de estreno

Solo en Android, con `@capacitor/local-notifications`. AniList publica la fecha y hora de los
próximos episodios de cada anime en emisión, así que los avisos se programan en el propio teléfono
con esas horas y no hace falta un servidor que mande nada.

Cada vez que cambia la lista o los ajustes, `programarAvisos()` cancela los pendientes y programa de
nuevo los de los animes en «Viendo»: los de las próximas tres semanas, hasta 60. El id de cada aviso
es el id del anime por mil más el número de episodio, para que entre en un entero de 32 bits. Como
AniList solo conoce unas semanas hacia adelante, los avisos se renuevan cada vez que la lista se pone
al día. Al tocar uno se abre la ficha del anime.

El permiso de notificaciones se pide la primera vez que marcas «Lo estoy viendo» en algo que sigue
emitiéndose, y no al abrir la app. Cuando Android lo concede, los avisos se programan en ese momento.

Un detalle de Capacitor que costó encontrar: el objeto de un plugin no se puede devolver desde una
promesa. Es un proxy que responde a cualquier método, `then` incluido, y la promesa lo trata como
otra promesa: `import(...).then((m) => m.LocalNotifications)` falla con
`"LocalNotifications.then()" is not implemented on android` y el permiso nunca se pide. Por eso el
plugin se importa tal cual.

## El calendario

`airingSchedules` trae los episodios que se emiten entre dos instantes, ordenados por hora. El
calendario pide un día a la vez (de medianoche a medianoche en tu zona horaria, en páginas de 50) y
los agrupa por hora. En el día de hoy, la línea de «ahora» va antes del primer episodio que todavía
no salió, y la pantalla se desplaza hasta ella al abrir.

## La temporada

Las temporadas son las de Japón: invierno de enero a marzo, primavera de abril a junio, y así. En el
hemisferio sur esos nombres no coinciden con el clima, así que cada temporada lleva al lado sus
meses («Otoño 2026 · oct · nov · dic»).

## La ficha

La sinopsis de AniList viene en inglés y con algo de HTML (`<br>`, `<i>`), marcas de spoiler
(`~!…!~`) y a veces la fuente al final. `src/lib/texto.ts` la pasa a párrafos de texto plano, así que
nada de lo que viene de AniList se inserta como HTML. Donde el navegador trae su propio traductor
(la API `Translator` de Chrome, que traduce en el dispositivo), aparece «Traducir al español».

Las plataformas son los `externalLinks` de tipo `STREAMING` que AniList no marca como deshabilitados,
una por plataforma e idioma. Lo que hay en cada una cambia según el país, así que debajo va un
enlace a JustWatch con el país que sale del idioma del navegador o, si no lo dice, de la zona horaria.

El tráiler, en la web, se carga recién al tocarlo (una miniatura y después el reproductor de
`youtube-nocookie.com`). En la app se abre en YouTube.

## Navegación

La dirección lleva la pantalla en el hash (`#/lista`, `#/calendario`, `#/anime/123`), así que en la
web se puede compartir el enlace a una ficha. Cambiar de pestaña reemplaza la entrada del historial
en vez de agregar una, y «atrás» (el botón de Android o el del navegador) cierra fichas en lugar de
recorrer pestañas.

Las pestañas se montan la primera vez que las abres y después quedan escondidas con
`visibility: hidden`, sin desmontarse: al volver a una, sigue donde la dejaste. La ficha se abre
encima, en su propia capa.

## Diseño

Una revista de manga semanal: papel de periódico, tinta negra, los tres colores de imprenta
(magenta, cian y amarillo) y tramas de puntos hechas con `radial-gradient`. Las portadas llevan
borde de tinta y sombra sólida, la nota va en un sello, y el banner de cada ficha se imprime a dos
tintas (la imagen en grises con `mix-blend-mode: multiply` sobre magenta). El próximo episodio va
en una tarjeta de «つづく», como la del final de un capítulo. Todos los colores son variables de CSS
en `:root`, y el modo oscuro solo las cambia.

Los títulos van en Dela Gothic One. La versión japonesa completa pesa 944 KB por los miles de
kanji; `scripts/fuente.py` se queda con el latín, el hiragana, el katakana y solo los kanji que
aparecen en el código, y junta todo en un archivo de 28 KB. Hay que volver a correrlo cuando se
agrega texto en japonés.

El ícono es una «つ» en color papel sobre tinta, con una trama magenta que se achica hacia el
centro. `scripts/icono.py` lo dibuja con la misma fuente y escribe el SVG de la web y los vectores
de Android: el ícono adaptable, su versión monocroma, el de Android 7 y el chico de los avisos.
Los PNG del manifiesto web (`public/icono-*.png`) son ese mismo SVG exportado a 180, 192 y 512 px.
