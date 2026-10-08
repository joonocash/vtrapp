"""Pilflykt — siluetter (formen på brädet) ur Fluent Emoji Flat (MIT).
Sparas en gång i 40 rutors upplösning, hex per rad; spelet skalar ner.

python3 former.py <png-mapp> ../../pilar/former.js
"""
import sys, json, os
import numpy as np
from PIL import Image
FORMER = [
 ('red-heart','Hjärta'),('star','Stjärna'),('red-apple','Äpple'),('cat-face','Katt'),('tropical-fish','Fisk'),
 ('mushroom','Svamp'),('ghost','Spöke'),('house','Hus'),('deciduous-tree','Träd'),('crown','Krona'),
 ('panda','Panda'),('rabbit-face','Kanin'),('butterfly','Fjäril'),('spouting-whale','Val'),('turtle','Sköldpadda'),
 ('frog','Groda'),('octopus','Bläckfisk'),('snowman','Snögubbe'),('dog-face','Hund'),('cupcake','Muffin'),
 ('bear','Björn'),('pear','Päron'),('lemon','Citron'),('sun-with-face','Sol'),('teapot','Tekanna'),
 ('t-rex','T-rex'),('elephant','Elefant'),('penguin','Pingvin'),('soft-ice-cream','Glass'),('rocket','Raket'),
 ('lion','Lejon'),('owl','Uggla'),('hamburger','Hamburgare'),('doughnut','Munk'),('jack-o-lantern','Pumpa'),
 ('sailboat','Segelbåt'),('cactus','Kaktus'),('koala','Koala'),('dolphin','Delfin'),('snail','Snigel'),
]
N = 40


def main():
    ut = []
    for namn, sv in FORMER:
        im = Image.open(os.path.join(sys.argv[1], namn + '.png')).convert('RGBA')
        im = im.crop(im.getbbox())
        w0, h0 = im.size
        k = N / max(w0, h0)
        w1, h1 = max(1, round(w0 * k)), max(1, round(h0 * k))
        a = np.asarray(im.resize((w1 * 4, h1 * 4), Image.LANCZOS))[..., 3].astype(float) / 255
        a = a.reshape(h1, 4, w1, 4).mean((1, 3))
        m = a > 0.5
        rader = []
        for row in m:
            bits = ''.join('1' if b else '0' for b in row)
            rader.append(format(int(bits, 2), 'x').zfill((w1 + 3) // 4))
        ut.append({'id': namn, 'namn': sv, 'w': int(w1), 'h': int(h1), 'rader': rader})
    PNG = sys.argv[1]
    with open(sys.argv[2], 'w') as f:
        f.write('// Pilflykt — brädformer (siluetter), 40 rutor på längsta sidan, en hexsträng per rad.\n')
        f.write('// Gjorda ur Microsoft Fluent Emoji Flat (MIT-licens): https://github.com/microsoft/fluentui-emoji\n')
        f.write('// Spelet skalar ner dem med formMask() i engine.js. Genererad av pixel/verktyg/former.py.\n\n')
        f.write('export default [\n')
        for x in ut:
            f.write('  ' + json.dumps(x, ensure_ascii=False, separators=(',', ':')) + ',\n')
        f.write(']\n')
    print(len(ut), os.path.getsize(sys.argv[2]))


if __name__ == '__main__':
    main()
