"""Dibuja el ícono de Tsuzuku: una «つ» (la primera letra de つづく) en color papel sobre tinta,
con una trama de puntos magenta que se desvanece desde la esquina, como el tono de un manga.

Sale de la misma fuente de los títulos, así que no hay imágenes que mantener a mano:

    python scripts/icono.py

Escribe el ícono de la web (public/) y los de Android (android/app/src/main/res/).
"""
import math
import pathlib

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / 'node_modules/@fontsource/dela-gothic-one/files/dela-gothic-one-japanese-400-normal.woff2'
RES = RAIZ / 'android/app/src/main/res'

TINTA = '#17161B'
PAPEL = '#F2EDE3'
MAGENTA = '#E4007C'

fuente = TTFont(FUENTE)
glifos = fuente.getGlyphSet()
glifo = glifos[fuente.getBestCmap()[ord('つ')]]
pen = SVGPathPen(glifos)
glifo.draw(pen)
TRAZO = pen.getCommands()
limites = BoundsPen(glifos)
glifo.draw(limites)
X0, Y0, X1, Y1 = limites.bounds


def colocar(cx, cy, ancho):
    """Escala y posición para dejar la letra centrada en (cx, cy) con ese ancho (la fuente va con
    el eje y hacia arriba; aquí se da vuelta)."""
    s = ancho / (X1 - X0)
    return s, cx - s * (X0 + X1) / 2, cy + s * (Y0 + Y1) / 2


def trama(lado, paso):
    """Puntos que crecen hacia la esquina de abajo a la izquierda y desaparecen hacia el centro."""
    puntos = []
    for fila in range(int(lado / paso) + 1):
        for col in range(int(lado / paso) + 1):
            x = col * paso + (paso / 2 if fila % 2 else 0)
            y = fila * paso
            d = math.hypot(x, lado - y) / (lado * 0.95)
            r = paso * 0.42 * max(0.0, 1 - d) ** 0.9
            if r > paso * 0.06:
                puntos.append((x, y, r))
    return puntos


def circulos(puntos):
    return ''.join(f'M{x - r:.2f},{y:.2f}a{r:.2f},{r:.2f} 0 1,0 {2 * r:.2f},0a{r:.2f},{r:.2f} 0 1,0 {-2 * r:.2f},0' for x, y, r in puntos)


def svg(redondeado):
    s, tx, ty = colocar(256, 262, 318)
    fondo = f'<rect width="512" height="512" rx="112" fill="{TINTA}"/>' if redondeado else f'<rect width="512" height="512" fill="{TINTA}"/>'
    recorte = '<clipPath id="c"><rect width="512" height="512" rx="112"/></clipPath>' if redondeado else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>{recorte}</defs>{fondo}'
        f'<path fill="{MAGENTA}"{" clip-path=\"url(#c)\"" if redondeado else ""} d="{circulos(trama(512, 21))}"/>'
        f'<path fill="{PAPEL}" transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f} {-s:.5f})" d="{TRAZO}"/></svg>\n'
    )


def vector(ancho_dp, alto_dp, lado, capas):
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- Generado por scripts/icono.py -->\n'
        f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="{ancho_dp}dp" android:height="{alto_dp}dp" '
        f'android:viewportWidth="{lado}" android:viewportHeight="{lado}">\n{capas}</vector>\n'
    )


def letra(cx, cy, ancho, color):
    s, tx, ty = colocar(cx, cy, ancho)
    return (
        f'    <group android:translateX="{tx:.3f}" android:translateY="{ty:.3f}" android:scaleX="{s:.5f}" android:scaleY="{-s:.5f}">\n'
        f'        <path android:fillColor="{color}" android:pathData="{TRAZO}" />\n    </group>\n'
    )


def escribir(ruta, texto):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(texto, encoding='utf-8', newline='\n')
    print(ruta.relative_to(RAIZ))


escribir(RAIZ / 'public/icono.svg', svg(True))
escribir(RAIZ / 'public/icono-maskable.svg', svg(False))

if RES.exists():
    # Ícono adaptable (Android 8+): la placa de tinta es el fondo; la trama y la letra, el frente.
    # La letra queda dentro del círculo de 66 dp que ningún recorte de launcher toca.
    puntos = [(x, y, r) for x, y, r in trama(108, 4.6)]
    escribir(RES / 'values/ic_launcher_background.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{TINTA}</color>\n</resources>\n')
    escribir(
        RES / 'drawable/ic_launcher_foreground.xml',
        vector(108, 108, 108, f'    <path android:fillColor="{MAGENTA}" android:pathData="{circulos(puntos)}" />\n' + letra(54, 55, 52, PAPEL)),
    )
    escribir(RES / 'drawable/ic_launcher_monochrome.xml', vector(108, 108, 108, letra(54, 55, 52, '#FFFFFF')))
    adaptable = (
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n'
    )
    escribir(RES / 'mipmap-anydpi-v26/ic_launcher.xml', adaptable)
    escribir(RES / 'mipmap-anydpi-v26/ic_launcher_round.xml', adaptable)
    # Android 7 no tiene íconos adaptables: la misma placa, ya redondeada.
    placa = 'M24,4h60a20,20 0 0 1 20,20v60a20,20 0 0 1 -20,20h-60a20,20 0 0 1 -20,-20v-60a20,20 0 0 1 20,-20z'
    dentro = [(x, y, r) for x, y, r in puntos if 6 < x < 102 and 6 < y < 102]
    legado = vector(
        108, 108, 108,
        f'    <path android:fillColor="{TINTA}" android:pathData="{placa}" />\n'
        f'    <path android:fillColor="{MAGENTA}" android:pathData="{circulos(dentro)}" />\n' + letra(54, 55, 60, PAPEL),
    )
    escribir(RES / 'mipmap-anydpi/ic_launcher.xml', legado)
    escribir(RES / 'mipmap-anydpi/ic_launcher_round.xml', legado)
    # El ícono chico de los avisos: solo la silueta, en blanco (Android lo tiñe).
    escribir(RES / 'drawable/ic_aviso.xml', vector(24, 24, 24, letra(12, 12.3, 20, '#FFFFFF')))
