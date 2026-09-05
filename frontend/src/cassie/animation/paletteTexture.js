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
   * och ersätter sedan varje aktiv override — `sourceHex` (den ursprungliga
   * rutans färg) med `hex` (den valda ersättningsfärgen), var den än
   * förekommer i bilden. `sourceHex` eller `hex` null/tomt hoppas över —
   * den rutan lämnas i sitt originalskick.
   * @param {{sourceHex: string|null, hex: string|null}[]} overrides
   */
  regenerate(overrides) {
    const imageData = new ImageData(
      new Uint8ClampedArray(this.originalImageData.data),
      this.width,
      this.height
    );

    for (const { sourceHex, hex } of overrides) {
      if (!sourceHex || !hex) continue;
      replaceColor(imageData, hexToRgb(sourceHex), hexToRgb(hex));
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
