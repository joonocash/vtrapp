import * as THREE from 'three';

// Kenney-modellen har ETT delat material ("colormap", basfärg vit) för hela
// karossen — all synlig färg kommer från en liten palett-textur som varje
// mesh UV-mappar mot en enskild rutas solida färg. Att tona material.color
// färgar därför HELA lastbilen på en gång, inte bara en del.
//
// Strategin här i stället: rita palett-texturen till en canvas, och när
// användaren väljer en färg — flood-filla just den kontinuerliga rutan (från
// en känd startpixel) med den nya färgen, i en canvas-kopia. Originalet
// bevaras orört så "ingen override" alltid går att återställa exakt.

const FLOOD_FILL_TOLERANCE = 40; // Euklidiskt avstånd i 0..255 RGB, per kanal

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
 * 4-anslutet flood fill i en ImageData, muterar den in-place. Startar vid
 * (startX, startY) och sprider sig så länge pixlarna ligger inom
 * `tolerance` av startpixelns färg — dvs den fyller precis den
 * sammanhängande rutan, inte hela bilden.
 */
export function floodFillReplace(imageData, width, height, startX, startY, [nr, ng, nb], tolerance = FLOOD_FILL_TOLERANCE) {
  const { data } = imageData;
  const x0 = Math.max(0, Math.min(width - 1, Math.round(startX)));
  const y0 = Math.max(0, Math.min(height - 1, Math.round(startY)));
  const startIdx = (y0 * width + x0) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const toleranceSq = tolerance * tolerance;

  const visited = new Uint8Array(width * height);
  const stack = [[x0, y0]];
  let filled = 0;

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) continue;
    visited[pixelIndex] = 1;

    const idx = pixelIndex * 4;
    if (colorDistanceSq(data[idx], data[idx + 1], data[idx + 2], tr, tg, tb) > toleranceSq) continue;

    data[idx] = nr;
    data[idx + 1] = ng;
    data[idx + 2] = nb;
    filled += 1;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return filled;
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
      if (colorDistanceSq(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2]) > 30 * 30) {
        boundaries.push(i);
      }
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
   * och applicerar sedan varje override som ett flood fill från dess
   * frö-pixlar. `hex: null` betyder "ingen override" — den rutan lämnas
   * alltså i sitt originalskick.
   * @param {{seeds: {x:number, y:number}[], hex: string|null}[]} overrides
   */
  regenerate(overrides) {
    const imageData = new ImageData(
      new Uint8ClampedArray(this.originalImageData.data),
      this.width,
      this.height
    );

    for (const { seeds, hex } of overrides) {
      if (!hex) continue;
      const rgb = hexToRgb(hex);
      for (const { x, y } of seeds) {
        floodFillReplace(imageData, this.width, this.height, x, y, rgb);
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
