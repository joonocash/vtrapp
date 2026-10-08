"""Pixelkanon — gör spelets bilder.

Emoji: Microsoft Fluent Emoji Flat (MIT), renderade till PNG med render.cjs.
Happy: foton ur revir/album, beskurna och förstärkta.

Varje bild kvantiseras och färgerna läggs på spelets fasta palett, så att
en röd gris alltid är samma röd och alla färger går att skilja åt.

python3 gor_bilder.py <png-mapp> <happy-mapp> <ut.json>
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageOps, ImageEnhance
sys.path.insert(0, os.path.dirname(__file__))
from pixla import srgb_to_lab, kmeans

# Spelets palett. Ordningen är id:t i banorna (0-9, a-l).
PALETT = [
    ('vit', '#f5f3ee'), ('ljusgrå', '#c4c9d4'), ('grå', '#868c99'), ('svart', '#2c2c35'),
    ('röd', '#e53935'), ('mörkröd', '#9e1b32'), ('rosa', '#ff6fae'), ('ljusrosa', '#ffb8cf'),
    ('orange', '#ff8a1f'), ('gul', '#ffd43b'), ('beige', '#f0c891'), ('brun', '#a0612f'),
    ('mörkbrun', '#5d3a22'), ('lime', '#a4d936'), ('grön', '#2fb55a'), ('mörkgrön', '#1f7a48'),
    ('turkos', '#22c3b5'), ('ljusblå', '#74d0f7'), ('blå', '#2f6fe0'), ('mörkblå', '#283a8f'),
    ('lila', '#8e5ad8'), ('ljuslila', '#cdb1f2'),
]
TECKEN = '0123456789abcdefghijkl'
PAL_RGB = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for _, h in PALETT], float)
PAL_LAB = srgb_to_lab(PAL_RGB)

# (emoji-namn, svenskt namn). Ordningen här är ordningen i spelet.
EMOJI = [
    ('cherries', 'Körsbär'), ('red-apple', 'Äpple'), ('cat-face', 'Katt'), ('red-heart', 'Hjärta'),
    ('mushroom', 'Flugsvamp'), ('strawberry', 'Jordgubbe'), ('frog', 'Groda'), ('watermelon', 'Vattenmelon'),
    ('hatching-chick', 'Kyckling'), ('star', 'Stjärna'), ('lady-beetle', 'Nyckelpiga'), ('soft-ice-cream', 'Mjukglass'),
    ('fox', 'Räv'), ('cactus', 'Kaktus'), ('doughnut', 'Munk'), ('rainbow', 'Regnbåge'),
    ('panda', 'Panda'), ('rocket', 'Raket'), ('cupcake', 'Muffin'), ('tulip', 'Tulpan'),
    ('penguin', 'Pingvin'), ('pizza', 'Pizza'), ('octopus', 'Bläckfisk'), ('sunflower', 'Solros'),
    ('rabbit-face', 'Kanin'), ('hamburger', 'Hamburgare'), ('spouting-whale', 'Val'), ('crown', 'Krona'),
    ('owl', 'Uggla'), ('avocado', 'Avokado'), ('house', 'Hus'), ('butterfly', 'Fjäril'),
    ('lion', 'Lejon'), ('sushi', 'Sushi'), ('snowman', 'Snögubbe'), ('tropical-fish', 'Tropisk fisk'),
    ('honeybee', 'Bi'), ('lollipop', 'Klubba'), ('parrot', 'Papegoja'), ('teapot', 'Tekanna'),
    ('dog-face', 'Hund'), ('christmas-tree', 'Julgran'), ('crab', 'Krabba'), ('robot', 'Robot'),
    ('kiwi-fruit', 'Kiwi'), ('turtle', 'Sköldpadda'), ('alien', 'Rymdvarelse'), ('cherry-blossom', 'Körsbärsblom'),
    ('tiger-face', 'Tiger'), ('popcorn', 'Popcorn'), ('dolphin', 'Delfin'), ('trophy', 'Pokal'),
    ('koala', 'Koala'), ('eggplant', 'Aubergine'), ('ghost', 'Spöke'), ('sailboat', 'Segelbåt'),
    ('monkey-face', 'Apa'), ('taco', 'Taco'), ('unicorn', 'Enhörning'), ('alarm-clock', 'Väckarklocka'),
    ('peacock', 'Påfågel'), ('shortcake', 'Tårtbit'), ('snail', 'Snigel'), ('ringed-planet', 'Saturnus'),
    ('flamingo', 'Flamingo'), ('jack-o-lantern', 'Pumpalykta'), ('bear', 'Björn'), ('guitar', 'Gitarr'),
    ('t-rex', 'T-rex'), ('hibiscus', 'Hibiskus'), ('hot-beverage', 'Kaffe'), ('sloth', 'Sengångare'),
    ('soccer-ball', 'Fotboll'), ('pineapple', 'Ananas'), ('helicopter', 'Helikopter'), ('teddy-bear', 'Nalle'),
    ('tram', 'Spårvagn'), ('crystal-ball', 'Kristallkula'), ('dragon-face', 'Drake'), ('pancakes', 'Pannkakor'),
    ('hedgehog', 'Igelkott'), ('bubble-tea', 'Bubbelte'), ('basketball', 'Basket'), ('gem-stone', 'Ädelsten'),
    ('elephant', 'Elefant'), ('candy', 'Godis'), ('chicken', 'Höna'), ('sun-with-face', 'Sol'),
    ('kite', 'Drake (flyg)'), ('volcano', 'Vulkan'), ('ferris-wheel', 'Pariserhjul'), ('video-game', 'Handkontroll'),
    ('otter', 'Utter'), ('birthday-cake', 'Tårta'), ('seal', 'Säl'), ('lemon', 'Citron'),
    ('potted-plant', 'Krukväxt'), ('hamster', 'Hamster'), ('umbrella', 'Paraply'), ('fire', 'Eld'),
]

# Happy: (fil, beskärning i 480-pixlarnas koordinater)
HAPPY = [
    ('17-snopromenad', (190, 70, 470, 350)),
    ('15-rodhalsduk', (50, 10, 430, 390)),
    ('04-kandisen', (110, 20, 470, 380)),
    ('23-angsvandring', (90, 100, 390, 400)),
]


def till_palett(rgb, mask, maxk, minandel=0.03):
    """Kvantisera pixlarna i mask och lägg dem på paletten. Returnerar n×n med palett-id eller -1."""
    n_h, n_w = mask.shape
    X = srgb_to_lab(rgb[mask])
    cent, lab = kmeans(X, min(maxk + 3, len(X)))
    # varje kluster -> närmaste palettfärg
    snap = [int(np.argmin(((PAL_LAB - c) ** 2).sum(-1))) for c in cent]
    full = np.full(mask.shape, -1)
    full[mask] = np.array([snap[l] for l in lab])
    # för många färger eller väldigt små: flytta de minsta till närmaste kvarvarande
    while True:
        ids, counts = np.unique(full[full >= 0], return_counts=True)
        tot = counts.sum()
        if len(ids) <= 1:
            break
        i_min = int(np.argmin(counts))
        if len(ids) > maxk or counts[i_min] < max(3, minandel * tot):
            liten = ids[i_min]
            andra = [int(i) for i in ids if i != liten]
            ys, xs = np.where(full == liten)
            for y, x in zip(ys, xs):
                px = srgb_to_lab(rgb[y, x][None])[0]
                full[y, x] = min(andra, key=lambda o: ((PAL_LAB[o] - px) ** 2).sum())
            continue
        break
    return full


def emoji_bild(path, n, maxk):
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getbbox())
    w0, h0 = im.size
    s = max(w0, h0)
    ny = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ny.paste(im, ((s - w0) // 2, (s - h0) // 2))
    im = ny.resize((n * 8, n * 8), Image.LANCZOS)
    arr = np.asarray(im).astype(float)
    a = arr[..., 3:4] / 255.0
    pre = (arr[..., :3] * a).reshape(n, 8, n, 8, 3).mean((1, 3))
    al = a.reshape(n, 8, n, 8, 1).mean((1, 3))
    rgb = np.where(al > 0, pre / np.maximum(al, 1e-6), 0)
    mask = al[..., 0] > 0.5
    return till_palett(rgb, mask, maxk)


def foto_bild(path, crop, n, maxk):
    im = Image.open(path).convert('RGB').crop(crop)
    im = ImageOps.autocontrast(im, cutoff=2)
    im = ImageEnhance.Color(im).enhance(1.35)
    im = ImageEnhance.Contrast(im).enhance(1.15)
    rgb = np.asarray(im.resize((n, n), Image.LANCZOS)).astype(float)
    return till_palett(rgb, np.ones((n, n), bool), maxk, minandel=0.02)


def rader(full):
    rows = [''.join(TECKEN[v] if v >= 0 else '.' for v in r) for r in full]
    while rows and set(rows[0]) == {'.'}:
        rows.pop(0)
    while rows and set(rows[-1]) == {'.'}:
        rows.pop()
    while rows and all(r[0] == '.' for r in rows):
        rows = [r[1:] for r in rows]
    while rows and all(r[-1] == '.' for r in rows):
        rows = [r[:-1] for r in rows]
    return rows


if __name__ == '__main__':
    png, happydir, ut = sys.argv[1], sys.argv[2], sys.argv[3]
    STORLEKAR = [16, 20, 24]
    bilder = []
    for namn, sv in EMOJI:
        p = os.path.join(png, namn + '.png')
        if not os.path.exists(p):
            print('saknas', namn, file=sys.stderr)
            continue
        storlekar = {}
        for n in STORLEKAR:
            storlekar[str(n)] = rader(emoji_bild(p, n, 6))
        bilder.append({'id': namn, 'namn': sv, 'storlekar': storlekar})
    happy = []
    for fil, crop in HAPPY:
        p = os.path.join(happydir, fil + '.webp')
        happy.append({'id': 'happy-' + fil[3:], 'fil': fil + '.webp', 'rader': rader(foto_bild(p, crop, 24, 6))})
    with open(ut, 'w') as f:
        f.write('// Pixelkanon — bilderna. Genererad av verktyg/gor_bilder.py, ändra inte för hand.\n')
        f.write('// Emoji: Microsoft Fluent Emoji Flat (MIT-licens), https://github.com/microsoft/fluentui-emoji\n')
        f.write('// Happy: foton ur revir/album, pixlade.\n')
        f.write('// En bild = rader med ett tecken per kub: palettens index (0-9, a-l) eller . för tomt.\n\n')
        f.write('export const PALETT = ' + json.dumps([{'namn': n, 'hex': h} for n, h in PALETT], ensure_ascii=False) + '\n\n')
        f.write('export const BILDER = [\n')
        for b in bilder:
            f.write('  ' + json.dumps(b, ensure_ascii=False, separators=(',', ':')) + ',\n')
        f.write(']\n\nexport const HAPPY = [\n')
        for h in happy:
            f.write('  ' + json.dumps(h, ensure_ascii=False, separators=(',', ':')) + ',\n')
        f.write(']\n')
    print(len(bilder), 'bilder', len(happy), 'happy', os.path.getsize(ut), 'byte')
