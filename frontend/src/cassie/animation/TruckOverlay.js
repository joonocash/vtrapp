import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groundMetersPerPixel } from './routeMath.js';
import { PaletteTexture, detectGrid, rgbToHex } from './paletteTexture.js';

// Ren three.js — ingen google.maps-referens här. Lyder samma duck-typade
// protokoll som ett riktigt google.maps.WebGLOverlayView förväntar sig
// (onAdd/onContextRestored/onContextLost/onDraw/onRemove), men det är
// GoogleMapProvider.js som äger den faktiska Google-klassen och vidarebefordrar
// anropen hit. `transformer` i onDraw är alltså ett Google-objekt vi bara
// anropar metoder på, aldrig importerar typen av.
//
// Lokalt koordinatsystem (från transformer.fromLatLngAltitude utan rotations-
// korrigering): X = öst, Y = norr, Z = upp. En modell som redan är rättad
// till det systemet pekar norrut vid heading 0.

const MODEL_URL = '/models/truck.glb';
// Meter över vägbanan — litet lyft undviker z-fighting mot markplattan.
const MODEL_ALTITUDE = 0.5;
// Modellens "framåt" pekar bakåt längs rutten vid 0 — glTF-tillgången är
// alltså byggd vänd åt andra hållet. 180° vänder den rätt. Appliceras som en
// egen, yttre rotation runt den redan upprättade vertikala axeln (se
// axisFixGroup/yawTrimGroup i onAdd) — INTE ihopslaget med upprätnings-
// rotationen i samma Euler-triplett, för då roterar den runt fel axel (se
// kommentaren där för varför).
const MODEL_YAW_TRIM_DEG = 180;
// Ungefärlig egen storlek (meter) hos modellen vid scale=1. Det här är
// kalibreringskonstanten mellan "pixlar på skärmen" (regeln användaren styr)
// och glTF-filens egna, okända enheter — justera om storleksreglaget känns
// fel skalat (t.ex. om hela intervallet blir för stort/litet).
const MODEL_UNIT_SIZE_METERS = 8;
// Standardvärde innan CassiePage hunnit sätta ett från URL-state.
const DEFAULT_PIXEL_SIZE = 90;

// Modellen har ETT delat material ("colormap") för hela karossen — hytt och
// skåp är inte skilda material, de är olika RUTOR i samma palett-textur som
// respektive mesh UV-mappar mot. Vi klassificerar därför per MESH (namnet på
// meshen eller dess förälder-nod), inte per material, och tar reda på vilken
// palettruta varje mesh pekar på genom dess genomsnittliga UV-koordinat (se
// paletteTexture.js). Namnmatchning är förstahandsförsöket; om inget namn ger
// besked faller vi tillbaka på den FAKTISKA färgen i palett-texturen vid den
// UV-koordinaten (modellen är som standard ljuslila hytt + grönt skåp).
const CAB_NAME_HINTS = ['cab', 'hytt', 'cockpit', 'driver', 'förar'];
const BOX_NAME_HINTS = ['box', 'skåp', 'trailer', 'container', 'cargo', 'load', 'back'];
// Delar vi ALDRIG får färga, oavsett hur nära de råkar ligga hue-intervallen
// nedan — annars förlorar lastbilen all form.
const EXCLUDE_NAME_HINTS = [
  'wheel',
  'tire',
  'tyre',
  'hjul',
  'glass',
  'window',
  'ruta',
  'ruter',
  'light',
  'lamp',
  'lykta',
  'bumper',
  'stötfångare',
  'chrome',
  'krom'
];
const CAB_HUE_RANGE = [245, 305]; // ljuslila/violett
const BOX_HUE_RANGE = [70, 160]; // grönt
const MIN_SATURATION_FOR_HUE_MATCH = 0.15;

function averageUV(geometry) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr || uvAttr.count === 0) return null;
  let sumU = 0;
  let sumV = 0;
  for (let i = 0; i < uvAttr.count; i++) {
    sumU += uvAttr.getX(i);
    sumV += uvAttr.getY(i);
  }
  return { u: sumU / uvAttr.count, v: sumV / uvAttr.count };
}

let instanceCounter = 0;

export class TruckOverlay {
  constructor() {
    // Unik per instans i loggarna — avslöjar om t.ex. React StrictMode (som
    // är påslaget i main.jsx) skapar fler överlägg än väntat samtidigt.
    this.id = `truck-${++instanceCounter}`;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.headingGroup = null;
    this.bankGroup = null;
    this.modelGroup = null;
    this.yawTrimGroup = null;
    this.axisFixGroup = null;
    this.pose = { lat: 0, lng: 0, headingDeg: 0, bankDeg: 0 };
    this.pixelSize = DEFAULT_PIXEL_SIZE;
    this.visible = true;
    this.loaded = false;
    // Palett-texturen (canvas + THREE.CanvasTexture) som ersätter det delade
    // materialets ursprungliga .map, plus vilka pixel-koordinater i den som
    // hör till respektive del. Fylls av classifyMeshesAndBuildPalette() när
    // modellen och dess textur laddat klart.
    this.paletteTexture = null;
    this.cabSeeds = [];
    this.boxSeeds = [];
    // Hex-strängar eller null ("använd modellens egen färg"). Kan sättas
    // innan modellen laddat klart (t.ex. från en inläst sparad rutt) —
    // classifyMeshesAndBuildPalette() applicerar dem så fort paletten finns.
    this.cabColorOverride = null;
    this.boxColorOverride = null;
    // Sätts av GoogleMapProvider.attachOverlay — enda kopplingen ut mot
    // kartmotorn, och den är opaque (bara en callback, ingen typreferens).
    this._requestRedraw = null;
    // Sätts av useRouteAnimation — rapporterar modellens egna standardfärger
    // uppåt så kontrollpanelens färgväljare kan visa rätt startvärde innan
    // användaren aktivt ändrat något.
    this._onColorsDiscovered = null;
  }

  onAdd() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.1);
    hemi.position.set(0, -0.2, 1).normalize();
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0, 10, 100);
    this.scene.add(sun);

    this.headingGroup = new THREE.Group(); // dynamisk: -bäring runt vertikal axel
    this.bankGroup = new THREE.Group(); // dynamisk: bank runt egen färdriktning
    this.modelGroup = new THREE.Group(); // dynamisk: skärmstorlek (scale), satt per bildruta i onDraw
    this.yawTrimGroup = new THREE.Group(); // STATISK: MODEL_YAW_TRIM_DEG
    this.axisFixGroup = new THREE.Group(); // STATISK: glTF Y-upp -> lokal Z-upp

    // Två separata grupper i stället för två Euler-komponenter på samma
    // objekt. Det spelar roll: en enda Object3D.rotation med både x och z
    // satta komponerar (i three.js standardordning 'XYZ') som Rx * Rz — det
    // vill säga z-rotationen appliceras FÖRST, runt modellens egen,
    // okorrigerade Z-axel (som pekar längs med lastbilen, inte upp/ner).
    // 180° där rullar alltså modellen runt sin egen längdaxel ("på ryggen")
    // i stället för att gira den. Genom att i stället nesta groups (barnets
    // transform appliceras före förälderns) blir kompositionen
    // yawTrimGroup(Rz) * axisFixGroup(Rx) — dvs upprätningen sker FÖRST och
    // giret sker EFTER, runt den då redan vertikala axeln.
    this.axisFixGroup.rotation.x = Math.PI / 2;
    this.yawTrimGroup.rotation.z = THREE.MathUtils.degToRad(MODEL_YAW_TRIM_DEG);

    this.yawTrimGroup.add(this.axisFixGroup);
    this.modelGroup.add(this.yawTrimGroup);
    this.bankGroup.add(this.modelGroup);
    this.headingGroup.add(this.bankGroup);
    this.scene.add(this.headingGroup);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        console.log(
          `[cassie:${this.id}] GLTFLoader klar — gltf.scenes: ${gltf.scenes?.length ?? 0}, ` +
            `gltf.scene = "${gltf.scene?.name || '(namnlös)'}" (${gltf.scene?.type}), ` +
            `direkta barn: ${gltf.scene?.children?.length ?? 0}`
        );
        // Klassificera INNAN gltf.scene flyttas in i vår grupphierarki.
        // .add() reparentar bara (sätter parent + pushar till children på
        // mottagaren) — det rör inte gltf.scene:s EGNA children-array, så
        // traverseringen ser samma träd oavsett — men vi gör det i den här
        // ordningen ändå så det är obestridligt att vi traverserar den nod
        // GLTFLoader faktiskt gav oss, innan något annat rört den.
        this.classifyMeshesAndBuildPalette(gltf.scene);
        this.axisFixGroup.add(gltf.scene);
        this.loaded = true;
        this.requestRedraw();
      },
      undefined,
      (err) => console.error(`[cassie:${this.id}] kunde inte ladda truck.glb:`, err)
    );
  }

  /**
   * Traverserar den laddade modellen mesh för mesh. Modellen har bara ETT
   * delat material ("colormap") — all färg kommer från en palett-textur som
   * varje mesh UV-mappar mot en enskild rutas solida färg. Vi kan alltså
   * inte skilja hytt från skåp via material; i stället:
   *  1. Bygger en om-färgningsbar canvas-kopia av palett-texturen
   *     (PaletteTexture) från det första materialet som har en .map.
   *  2. Räknar ut varje meshs genomsnittliga UV-koordinat och loggar den
   *     tillsammans med pixelkoordinaten och den faktiska färgen där i
   *     paletten — det är den loggen som visar vilka rutor som hör till vad.
   *  3. Klassificerar meshen via namnet (dess egna eller förälderns) i
   *     första hand, och den samplade palettfärgens nyans som fallback.
   * Rör aldrig hjul/rutor/lyktor/stötfångare.
   */
  classifyMeshesAndBuildPalette(root) {
    const meshes = [];
    let visitedCount = 0;
    const typeCounts = {};

    root.traverse((obj) => {
      visitedCount += 1;
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
      if (!obj.isMesh || !obj.material || !obj.geometry?.attributes?.uv) return;
      meshes.push(obj);
    });

    console.log(
      `[cassie:${this.id}] traverserade från roten "${root.name || '(namnlös)'}" ` +
        `(${root.type}, ${root.children?.length ?? 0} direkta barn) — ${visitedCount} noder totalt, ` +
        `${meshes.length} med UV. Typer:`,
      typeCounts
    );

    const sourceMaterial = meshes
      .flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]))
      .find((mat) => mat.map);
    if (!sourceMaterial) {
      console.warn(`[cassie:${this.id}] inget material med .map hittades — kan inte om-färga karossen.`);
      return;
    }

    this.paletteTexture = new PaletteTexture(sourceMaterial.map);
    // Alla mesh som delar materialet börjar nu sampla från vår
    // canvas-textur i stället för originalbilden — själva pixlarna är
    // identiska tills regenerate() kallas med en override.
    for (const mesh of meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat.map) {
          mat.map = this.paletteTexture.texture;
          mat.needsUpdate = true;
        }
      }
    }

    const grid = detectGrid(this.paletteTexture.originalImageData, this.paletteTexture.width, this.paletteTexture.height);
    console.log(
      `[cassie:${this.id}] palett ${this.paletteTexture.width}x${this.paletteTexture.height}px — ` +
        `bäst gissning på rutnät: ${grid.cols} kolumner x ${grid.rows} rader ` +
        `(kolumngränser vid x=${grid.colBoundaries.join(',')}, radgränser vid y=${grid.rowBoundaries.join(',')}). ` +
        'Rent gissningsverk om paletten inte faktiskt är ett regelbundet rutnät.'
    );

    console.log(`[cassie:${this.id}] mesh -> UV -> palettpixel -> färg:`);
    for (const mesh of meshes) {
      const uv = averageUV(mesh.geometry);
      if (!uv) continue;
      const pixel = this.paletteTexture.samplePixel(uv.u, uv.v);
      mesh.userData._paletteUV = uv;
      mesh.userData._palettePixel = pixel;
      console.log(
        `  "${mesh.name || '(namnlös)'}" (förälder: "${mesh.parent?.name || '(namnlös)'}") ` +
          `uv=(${uv.u.toFixed(3)}, ${uv.v.toFixed(3)}) px=(${pixel.x}, ${pixel.y}) ${rgbToHex(pixel.r, pixel.g, pixel.b)}`
      );
    }

    for (const mesh of meshes) {
      const pixel = mesh.userData._palettePixel;
      if (!pixel) continue;
      const combinedName = `${mesh.name || ''} ${mesh.parent?.name || ''}`.toLowerCase();
      if (EXCLUDE_NAME_HINTS.some((hint) => combinedName.includes(hint))) continue;

      let role = null;
      if (CAB_NAME_HINTS.some((hint) => combinedName.includes(hint))) role = 'cab';
      else if (BOX_NAME_HINTS.some((hint) => combinedName.includes(hint))) role = 'box';
      else {
        const color = new THREE.Color(pixel.r / 255, pixel.g / 255, pixel.b / 255);
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        const hueDeg = hsl.h * 360;
        if (hsl.s < MIN_SATURATION_FOR_HUE_MATCH) {
          // Nästan grå/svart/vit — sannolikt krom, gummi eller plast. Rör inte.
        } else if (hueDeg >= CAB_HUE_RANGE[0] && hueDeg <= CAB_HUE_RANGE[1]) {
          role = 'cab';
        } else if (hueDeg >= BOX_HUE_RANGE[0] && hueDeg <= BOX_HUE_RANGE[1]) {
          role = 'box';
        }
      }

      if (role === 'cab') this.cabSeeds.push({ x: pixel.x, y: pixel.y });
      else if (role === 'box') this.boxSeeds.push({ x: pixel.x, y: pixel.y });
    }

    console.log(`[cassie:${this.id}] klassificering — hytt-frön:`, this.cabSeeds, 'skåp-frön:', this.boxSeeds);

    const cabPixel = this.cabSeeds[0] ? this.paletteTexture.samplePixel(this.cabSeeds[0].x / this.paletteTexture.width, this.cabSeeds[0].y / this.paletteTexture.height) : null;
    const boxPixel = this.boxSeeds[0] ? this.paletteTexture.samplePixel(this.boxSeeds[0].x / this.paletteTexture.width, this.boxSeeds[0].y / this.paletteTexture.height) : null;
    this._onColorsDiscovered?.({
      cab: cabPixel ? rgbToHex(cabPixel.r, cabPixel.g, cabPixel.b) : null,
      box: boxPixel ? rgbToHex(boxPixel.r, boxPixel.g, boxPixel.b) : null
    });

    // Applicera overrides som redan hunnit sättas (t.ex. från en inläst
    // sparad rutt) innan paletten var klar.
    this.applyColorOverrides();
  }

  applyColorOverrides() {
    if (!this.paletteTexture) return;
    this.paletteTexture.regenerate([
      { seeds: this.cabSeeds, hex: this.cabColorOverride },
      { seeds: this.boxSeeds, hex: this.boxColorOverride }
    ]);
    this.requestRedraw();
  }

  /** @param {string | null} hex Null återställer till modellens originalfärg. */
  setCabColor(hex) {
    this.cabColorOverride = hex || null;
    this.applyColorOverrides();
  }

  /** @param {string | null} hex Null återställer till modellens originalfärg. */
  setBoxColor(hex) {
    this.boxColorOverride = hex || null;
    this.applyColorOverrides();
  }

  onContextRestored({ gl }) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes()
    });
    this.renderer.autoClear = false;
    this.renderer.autoClearDepth = false;
  }

  onContextLost() {
    this.renderer?.dispose();
    this.renderer = null;
  }

  /** @param {{lat:number, lng:number, headingDeg:number, bankDeg:number}} pose */
  setPose(pose) {
    this.pose = pose;
    if (this.headingGroup) {
      this.headingGroup.rotation.z = -THREE.MathUtils.degToRad(pose.headingDeg || 0);
    }
    if (this.bankGroup) {
      this.bankGroup.rotation.y = THREE.MathUtils.degToRad(pose.bankDeg || 0);
    }
  }

  setVisible(visible) {
    this.visible = visible;
  }

  /**
   * Önskad skärmstorlek i ungefärliga pixlar. Räknas om till en faktisk
   * meter-skala varje bildruta (se onDraw) utifrån aktuell zoomnivå, så att
   * lastbilen ser lika stor ut oavsett hur inzoomad kartan är just nu.
   */
  setPixelSize(px) {
    const value = Number(px);
    this.pixelSize = Number.isFinite(value) && value > 0 ? value : DEFAULT_PIXEL_SIZE;
    this.requestRedraw();
  }

  onDraw({ gl, transformer }) {
    if (!this.renderer || !this.scene || !this.camera) return;
    if (!this.visible || !this.loaded) return;

    // Skalan räknas om varje bildruta utifrån den faktiska kamerans zoom
    // just nu (inte en cachad "pace zoom") — annars blir den fel så fort
    // kameran rör sig, t.ex. under intro/outro-flygningen eller om
    // sliden dras medan kartan står still i en översiktsvy.
    const cameraParams = transformer.getCameraParams();
    const groundRes = groundMetersPerPixel(cameraParams.zoom, this.pose.lat);
    this.modelGroup.scale.setScalar((this.pixelSize * groundRes) / MODEL_UNIT_SIZE_METERS);

    const matrix = transformer.fromLatLngAltitude({
      lat: this.pose.lat,
      lng: this.pose.lng,
      altitude: MODEL_ALTITUDE
    });
    this.camera.projectionMatrix.fromArray(matrix);

    gl.disable(gl.SCISSOR_TEST);
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();
  }

  onRemove() {
    this.scene?.traverse((obj) => {
      obj.geometry?.dispose?.();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m?.dispose?.());
    });
    this.paletteTexture?.dispose();
    this.paletteTexture = null;
    this.scene = null;
    this.camera = null;
  }

  requestRedraw() {
    this._requestRedraw?.();
  }
}

export default TruckOverlay;
