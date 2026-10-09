"""Recorta Dela Gothic One a lo que usa la app.

La fuente japonesa completa pesa casi un mega por los miles de kanji. Esto se queda con el latín,
los signos, el hiragana, el katakana y solo los kanji que aparecen en src/. Hay que volver a
correrlo cuando se agrega texto en japonés:

    python scripts/fuente.py
"""
import os
import pathlib
import re
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARCHIVOS = RAIZ / 'node_modules/@fontsource/dela-gothic-one/files'
# Fontsource la reparte en trozos; el latín y el japonés van en archivos distintos.
ORIGENES = [ARCHIVOS / 'dela-gothic-one-latin-400-normal.woff2', ARCHIVOS / 'dela-gothic-one-japanese-400-normal.woff2']
DESTINO = RAIZ / 'src/fuentes/dela-gothic-one.woff2'
RANGOS = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x3000, 0x303F), (0x3040, 0x30FF), (0xFF01, 0xFF5E)]

kanji = set()
for f in (RAIZ / 'src').rglob('*'):
    if f.suffix in ('.svelte', '.ts', '.css'):
        kanji |= set(re.findall(r'[㐀-鿿々]', f.read_text(encoding='utf-8')))
unicodes = {c for a, b in RANGOS for c in range(a, b + 1)} | {ord(k) for k in kanji}

opciones = subset.Options()
opciones.layout_features = ['*']
opciones.name_IDs = ['*']
temporales = []
for origen in ORIGENES:
    fuente = TTFont(origen)
    recorte = subset.Subsetter(opciones)
    recorte.populate(unicodes=unicodes & set(fuente.getBestCmap()))
    recorte.subset(fuente)
    fuente.flavor = None
    with tempfile.NamedTemporaryFile(suffix='.ttf', delete=False) as t:
        fuente.save(t.name)
        temporales.append(t.name)

final = Merger().merge(temporales)
for t in temporales:
    os.unlink(t)
final.flavor = 'woff2'
DESTINO.parent.mkdir(parents=True, exist_ok=True)
final.save(DESTINO)
print(f'{DESTINO.relative_to(RAIZ)}: {DESTINO.stat().st_size // 1024} KB, kanji: {"".join(sorted(kanji))}')
