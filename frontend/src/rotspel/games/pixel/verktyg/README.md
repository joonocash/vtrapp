# Verktyg för bilderna

Pixelkanons bilder (`../bilder.js`) och Pilflykts brädformer (`../../pilar/former.js`)
är genererade. Ändra inte filerna för hand — ändra listorna i skripten och kör om.

Källor:

- **Emoji:** [Microsoft Fluent Emoji Flat](https://github.com/microsoft/fluentui-emoji),
  MIT-licens. Hämtas från npm-paketet `@iconify-json/fluent-emoji-flat`.
- **Happy:** fotona i `../../revir/album/`, beskurna och pixlade.

Varje bild kvantiseras och läggs på spelets fasta palett (22 färger i
`gor_bilder.py`), så att en röd gris alltid är samma röd.

## Kör om

Kräver Node och Python 3 med Pillow och numpy.

```bash
cd frontend/src/rotspel/games/pixel/verktyg
mkdir -p /tmp/emoji && cd /tmp/emoji && npm init -y && npm install @iconify-json/fluent-emoji-flat @resvg/resvg-js
cd -  # tillbaka hit
NODE_PATH=/tmp/emoji/node_modules node render.cjs /tmp/emoji/png $(python3 -c "import gor_bilder as g, former as f; print(' '.join({n for n,_ in g.EMOJI} | {n for n,_ in f.FORMER}))")
python3 gor_bilder.py /tmp/emoji/png ../../revir/album ../bilder.js
python3 former.py /tmp/emoji/png ../../pilar/former.js
```

`former.py` och `gor_bilder.py` kör sitt huvudprogram bara när de startas
direkt, så raden ovan som läser listorna gör inget annat.
