import * as THREE from 'three';

// Kenney-modellen har ETT delat material ("colormap", basfärg vit) för hela
// karossen — all synlig färg kommer från en liten palett-textur som varje
// mesh UV-mappar mot. Att tona material.color färgar därför HELA lastbilen
// på en gång, inte bara en del.
//
// Modellen har dessutom bara sex meshar (dörr, fyra hjul, kaross), så en
// enskild mesh ("kaross") kan själv spänna över flera palettrutor — hytt och
// skåp sitter i SAMMA mesh. Att klassificera per mesh (eller ett medelvärde
// av dess UV) är alltså meningslöst. I stället: sampla EVERY vertex-UV i
// hela modellen, lista de FAKTISKA distinkta färgerna som används, och låt
// användaren peka ut vilken av dem som är hytten respektive skåpet.
//
// Om-färgning sker sedan genom att ersätta en given originalfärg (var den än
// förekommer i paletten) med en ny — inte flood fill från en punkt, eftersom
// vi nu känner den exakta färgen direkt och kan matcha den var som helst i
// bilden.

const COLOR_MATCH_TOLERANCE = 24; // Euklidiskt avstånd i 0..255 RGB, per kanal
const CLUSTER_TOLERANCE = 20; // Hur nära två samplade färger får ligga för att räknas som samma ruta

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

export function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** @returns {{h:number, s:number, l:number}} h/s/l i 0..1 */
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h / 6, s, l };
}

export function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

/** Kortaste cirkulära avstånd mellan två hue-värden (0..1), i grader (0..180). */
function hueDistanceDeg(h1, h2) {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 1 - diff) * 360;
}

/**
 * En roll (hytt/skåp) äger godtyckligt många källfärger, inte bara en — en
 * karossdel består oftast av en grundfärg plus mörkare/ljusare
 * skuggnyanser. Byter man alla mot EN platt ersättningsfärg försvinner
 * skuggningen och delen blir en siluett. I stället: räkna varje källfärgs
 * ljushet relativt gruppens LJUSASTE färg, och applicera samma förhållande
 * på ersättningsfärgens ljushet — grundfärgen blir ersättningsfärgen
 * oförändrad, skuggorna blir proportionerligt mörkare varianter av den.
 * @param {string[]} sourceHexes
 * @param {string|null} replacementHex
 * @returns {{sourceHex: string, targetHex: string}[]}
 */
export function computeGroupReplacementTargets(sourceHexes, replacementHex) {
  if (!sourceHexes?.length || !replacementHex) return [];

  const sources = sourceHexes.map((hex) => ({ hex, hsl: rgbToHsl(...hexToRgb(hex)) }));
  const maxL = Math.max(...sources.map((s) => s.hsl.l)) || 1;
  const replHsl = rgbToHsl(...hexToRgb(replacementHex));

  return sources.map(({ hex, hsl }) => {
    const ratio = maxL > 0 ? hsl.l / maxL : 1;
    const targetL = Math.max(0, Math.min(1, replHsl.l * ratio));
    const [r, g, b] = hslToRgb(replHsl.h, replHsl.s, targetL);
    return { sourceHex: hex, targetHex: rgbToHex(r, g, b) };
  });
}

/**
 * "Välj liknande": hittar alla palettfärger vars NYANS ligger nära en
 * referensfärgs, oavsett ljushet — det är vad som fångar en hel
 * grundfärg+skuggor-grupp med ett klick. Ignorerar nästan gråa/svarta/vita
 * kandidater (deras hue är numeriskt instabil och sannolikt hjul/krom, inte
 * en skuggnyans av referensfärgen).
 * @param {{hex:string, count:number}[]} colors
 * @param {string} referenceHex
 * @param {number} hueToleranceDeg
 * @param {number} minSaturation
 * @returns {string[]} hex-koder, referensfärgen inkluderad
 */
export function findSimilarHues(colors, referenceHex, hueToleranceDeg = 26, minSaturation = 0.12) {
  const refHsl = rgbToHsl(...hexToRgb(referenceHex));
  const matches = new Set([referenceHex]);

  for (const c of colors) {
    const hsl = rgbToHsl(...hexToRgb(c.hex));
    if (hsl.s < minSaturation) continue;
    if (hueDistanceDeg(hsl.h, refHsl.h) <= hueToleranceDeg) matches.add(c.hex);
  }

  return [...matches];
}

/**
 * Slår ihop en { hex: antal }-tally av exakt samplade färger till kluster av
 * "samma ruta" — texturkomprimering/bilinjär filtrering kan annars ge en
 * handfull nästan identiska nyanser per swatch i stället för en. Bearbetar
 * i fallande frekvensordning så varje klusters representant blir den mest
 * frekventa exakta nyansen i det klustret.
 */
export function clusterColors(rawCounts, tolerance = CLUSTER_TOLERANCE) {
  const entries = Object.entries(rawCounts)
    .map(([hex, count]) => ({ hex, rgb: hexToRgb(hex), count }))
    .sort((a, b) => b.count - a.count);

  const toleranceSq = tolerance * tolerance;
  const clusters = [];

  for (const entry of entries) {
    const cluster = clusters.find(
      (c) => colorDistanceSq(...c.rgb, ...entry.rgb) <= toleranceSq
    );
    if (cluster) cluster.count += entry.count;
    else clusters.push({ hex: entry.hex, rgb: entry.rgb, count: entry.count });
  }

  return clusters.sort((a, b) => b.count - a.count).map(({ hex, count }) => ({ hex, count }));
}

/**
 * Ersätter varje pixel som ligger inom `tolerance` av `fromRgb` med `toRgb`,
 * var som helst i bilden — inget frö-fyllning, vi vet redan exakt vilken
 * färg vi letar efter.
 */
export function replaceColor(imageData, fromRgb, toRgb, tolerance = COLOR_MATCH_TOLERANCE) {
  const { data } = imageData;
  const [fr, fg, fb] = fromRgb;
  const [tr, tg, tb] = toRgb;
  const toleranceSq = tolerance * tolerance;
  let replaced = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (colorDistanceSq(data[i], data[i + 1], data[i + 2], fr, fg, fb) <= toleranceSq) {
      data[i] = tr;
      data[i + 1] = tg;
      data[i + 2] = tb;
      replaced += 1;
    }
  }

  return replaced;
}

/**
 * Best-effort-detektering av en regelbunden rutindelning — bara för
 * loggning/debug. Letar färgövergångar längs en horisontell och en
 * vertikal mittlinje och räknar dem som kolumn-/radgränser. Säger inget om
 * paletten faktiskt INTE är en regelbunden rutnätsindelning.
 */
export function detectGrid(imageData, width, height) {
  const { data } = imageData;
  const sample = (x, y) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  function findBoundaries(getPixel, length) {
    const boundaries = [];
    let prev = getPixel(0);
    for (let i = 1; i < length; i++) {
      const cur = getPixel(i);
      if (colorDistanceSq(...prev, ...cur) > 30 * 30) boundaries.push(i);
      prev = cur;
    }
    return boundaries;
  }

  const colBoundaries = findBoundaries((x) => sample(x, Math.floor(height / 2)), width);
  const rowBoundaries = findBoundaries((y) => sample(Math.floor(width / 2), y), height);

  return {
    cols: colBoundaries.length + 1,
    rows: rowBoundaries.length + 1,
    colBoundaries,
    rowBoundaries
  };
}

/**
 * Äger den om-färgningsbara canvasen och THREE-texturen som ersätter en
 * delad palett-textur på ett material. Konstrueras en gång från
 * originaltexturens bild; `regenerate()` kan sedan kallas om och om igen
 * (t.ex. varje gång användaren drar i en färgväljare) utan att någonsin
 * tappa originalfärgerna.
 */
export class PaletteTexture {
  constructor(sourceTexture) {
    const image = sourceTexture.image;
    this.width = image.naturalWidth || image.width;
    this.height = image.naturalHeight || image.height;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.drawImage(image, 0, 0, this.width, this.height);
    this.originalImageData = this.ctx.getImageData(0, 0, this.width, this.height);

    this.texture = new THREE.CanvasTexture(this.canvas);
    // Matcha originaltexturens egenskaper så vi inte introducerar en synlig
    // skillnad (färgrymd, wrap, filtrering) mot resten av modellen.
    this.texture.colorSpace = sourceTexture.colorSpace;
    this.texture.flipY = sourceTexture.flipY;
    this.texture.wrapS = sourceTexture.wrapS;
    this.texture.wrapT = sourceTexture.wrapT;
    this.texture.magFilter = sourceTexture.magFilter;
    this.texture.minFilter = sourceTexture.minFilter;
    this.texture.generateMipmaps = sourceTexture.generateMipmaps;
    this.texture.needsUpdate = true;
  }

  /** @returns {{x:number, y:number, r:number, g:number, b:number}} */
  samplePixel(u, v) {
    const x = Math.max(0, Math.min(this.width - 1, Math.round(u * this.width)));
    const y = Math.max(0, Math.min(this.height - 1, Math.round(v * this.height)));
    const idx = (y * this.width + x) * 4;
    const { data } = this.originalImageData;
    return { x, y, r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  }

  /**
   * Ritar om canvasen från grunden (alltid från den pristina originalbilden)
   * och ersätter sedan varje par — `sourceHex` (en ursprunglig palettfärg)
   * med `targetHex` (dess redan uträknade ersättning, se
   * computeGroupReplacementTargets) — var de än förekommer i bilden.
   * Uppringaren ansvarar för att räkna ut targetHex per källfärg (t.ex. med
   * relativ ljushet inom en grupp); den här metoden bara applicerar paren.
   * @param {{sourceHex: string, targetHex: string}[]} pairs
   */
  regenerate(pairs) {
    const imageData = new ImageData(
      new Uint8ClampedArray(this.originalImageData.data),
      this.width,
      this.height
    );

    for (const { sourceHex, targetHex } of pairs) {
      if (!sourceHex || !targetHex) continue;
      replaceColor(imageData, hexToRgb(sourceHex), hexToRgb(targetHex));
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
