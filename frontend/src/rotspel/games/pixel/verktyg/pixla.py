"""Gör pixelkonst av PNG-bilder (emoji med alfa, eller foton).

python3 pixla.py <in.png> <storlek> <maxfärger> [foto]

Skriver JSON till stdout: {w, h, palette: [hex], rows: ["..0011.."]}
"""
import sys, json
import numpy as np
from PIL import Image

ALFABET = '0123456789abcdef'


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def kmeans(X, k, iters=40, seed=1):
    rng = np.random.default_rng(seed)
    # k-means++ start
    cent = [X[rng.integers(len(X))]]
    for _ in range(1, k):
        d = np.min(((X[:, None, :] - np.array(cent)[None]) ** 2).sum(-1), 1)
        if d.sum() == 0:
            break
        cent.append(X[rng.choice(len(X), p=d / d.sum())])
    cent = np.array(cent, dtype=float)
    for _ in range(iters):
        lab = np.argmin(((X[:, None, :] - cent[None]) ** 2).sum(-1), 1)
        ny = np.array([X[lab == i].mean(0) if np.any(lab == i) else cent[i] for i in range(len(cent))])
        if np.allclose(ny, cent):
            break
        cent = ny
    lab = np.argmin(((X[:, None, :] - cent[None]) ** 2).sum(-1), 1)
    return cent, lab


def pixla(path, n, maxk, foto=False, minandel=0.035, slaihop=14.0):
    im = Image.open(path).convert('RGBA')
    if foto:
        im = im.resize((n, n), Image.LANCZOS)
        arr = np.asarray(im).astype(float)
        rgb = arr[..., :3]
        mask = np.ones((n, n), bool)
    else:
        # Beskär till innehållet så motivet fyller rutan
        bbox = im.getbbox()
        im = im.crop(bbox)
        w0, h0 = im.size
        s = max(w0, h0)
        ny = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        ny.paste(im, ((s - w0) // 2, (s - h0) // 2))
        im = ny.resize((n * 8, n * 8), Image.LANCZOS)
        arr = np.asarray(im).astype(float)
        a = arr[..., 3:4] / 255.0
        pre = arr[..., :3] * a
        # boxa ner 8x8 med förmultiplicerad alfa
        pre = pre.reshape(n, 8, n, 8, 3).mean((1, 3))
        al = a.reshape(n, 8, n, 8, 1).mean((1, 3))
        rgb = np.where(al > 0, pre / np.maximum(al, 1e-6), 0)
        mask = al[..., 0] > 0.5
    X = srgb_to_lab(rgb[mask])
    k = min(maxk + 3, len(X))
    cent, lab = kmeans(X, k)
    # Slå ihop nära färger och väldigt små färger tills vi är nere på maxk
    full = np.full((n, n), -1)
    full[mask] = lab
    while True:
        ids = [i for i in range(len(cent)) if np.any(full == i)]
        counts = {i: int((full == i).sum()) for i in ids}
        tot = sum(counts.values())
        par = None
        bast = 1e9
        for i in ids:
            for j in ids:
                if j <= i:
                    continue
                d = float(np.sqrt(((cent[i] - cent[j]) ** 2).sum()))
                if d < bast:
                    bast, par = d, (i, j)
        liten = min(ids, key=lambda i: counts[i])
        if len(ids) > 2 and counts[liten] < max(3, minandel * tot):
            # flytta den minsta färgen till närmaste annan färg (per pixel)
            andra = [i for i in ids if i != liten]
            ys, xs = np.where(full == liten)
            for y, x in zip(ys, xs):
                px = srgb_to_lab(rgb[y, x][None])[0]
                full[y, x] = min(andra, key=lambda o: ((cent[o] - px) ** 2).sum())
            continue
        if par and (bast < slaihop or len(ids) > maxk):
            i, j = par
            ci, cj = counts[i], counts[j]
            cent[i] = (cent[i] * ci + cent[j] * cj) / (ci + cj)
            full[full == j] = i
            continue
        break
    ids = sorted({int(v) for v in full.flatten() if v >= 0}, key=lambda i: -cent[i][0])
    # Medelfärg i RGB för varje grupp, lite mer mättad
    pal = []
    for i in ids:
        c = rgb[full == i].mean(0)
        g = c.mean()
        c = np.clip(g + (c - g) * 1.15, 0, 255)
        pal.append('#%02x%02x%02x' % tuple(int(round(v)) for v in c))
    karta = {i: ALFABET[k] for k, i in enumerate(ids)}
    rows = [''.join(karta[int(v)] if v >= 0 else '.' for v in row) for row in full]
    # Trimma tomma rader/kolumner
    while rows and set(rows[0]) == {'.'}:
        rows.pop(0)
    while rows and set(rows[-1]) == {'.'}:
        rows.pop()
    while rows and all(r[0] == '.' for r in rows):
        rows = [r[1:] for r in rows]
    while rows and all(r[-1] == '.' for r in rows):
        rows = [r[:-1] for r in rows]
    return {'w': len(rows[0]), 'h': len(rows), 'palette': pal, 'rows': rows}


if __name__ == '__main__':
    p = sys.argv[1]
    n = int(sys.argv[2])
    k = int(sys.argv[3])
    foto = len(sys.argv) > 4 and sys.argv[4] == 'foto'
    print(json.dumps(pixla(p, n, k, foto)))
