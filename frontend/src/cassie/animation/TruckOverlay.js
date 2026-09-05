import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groundMetersPerPixel } from './routeMath.js';
import { PaletteTexture, detectGrid, rgbToHex, clusterColors, computeGroupReplacementTargets } from './paletteTexture.js';

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

// Modellen har ETT delat material ("colormap") för hela karossen och bara
// SEX meshar totalt (dörr, fyra hjul, kaross) — hytt och skåp sitter i SAMMA
// "kaross"-mesh, som spänner över flera palettrutor. Klassificering per mesh
// (eller ett medelvärde av dess UV) är alltså meningslös: ett medel-UV över
// flera rutor landar mitt emellan dem, på en färg som inte ens syns på
// modellen. Vi kan därför inte veta i förväg vilken del som är hytt/skåp —
// i stället samplas VARJE vertex-UV i hela modellen, de faktiska distinkta
// färgerna som används listas (se discoverPalette), och användaren pekar
// själv ut vilken som är hytten och vilken som är skåpet i kontrollpanelen.
function forEachVertexUV(geometry, callback) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) return;
  for (let i = 0; i < uvAttr.count; i++) {
    callback(uvAttr.getX(i), uvAttr.getY(i));
  }
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
    // materialets ursprungliga .map. Fylls av discoverPalette() när modellen
    // och dess textur laddat klart.
    this.paletteTexture = null;
    // Vilka UPPTÄCKTA originalfärger (hex[]) användaren pekat ut som hytt/
    // skåp — en roll kan äga godtyckligt många källfärger (grundfärg +
    // skuggnyanser) — och vilken ERSÄTTNINGSfärg (hex) gruppen ska bytas
    // mot. Kan sättas innan modellen laddat klart (t.ex. från en inläst
    // sparad rutt) — discoverPalette()/applyColorOverrides() applicerar dem
    // så fort paletten finns.
    this.cabSources = [];
    this.cabColorOverride = null;
    this.boxSources = [];
    this.boxColorOverride = null;
    // Sätts av GoogleMapProvider.attachOverlay — enda kopplingen ut mot
    // kartmotorn, och den är opaque (bara en callback, ingen typreferens).
    this._requestRedraw = null;
    // Sätts av useRouteAnimation — rapporterar den upptäckta paletten
    // (distinkta färger + hur många vertexar som använder var och en) uppåt
    // så kontrollpanelen kan visa dem som utbytbara rutor.
    this._onPaletteDiscovered = null;
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
        this.discoverPalette(gltf.scene);
        this.axisFixGroup.add(gltf.scene);
        this.loaded = true;
        this.requestRedraw();
      },
      undefined,
      (err) => console.error(`[cassie:${this.id}] kunde inte ladda truck.glb:`, err)
    );
  }

  /**
   * Traverserar den laddade modellen. Modellen har bara ETT delat material
   * ("colormap") och bara sex meshar — hytt och skåp sitter i samma mesh,
   * så vi kan inte klassificera per mesh. I stället:
   *  1. Bygger en om-färgningsbar canvas-kopia av palett-texturen
   *     (PaletteTexture) från det första materialet som har en .map.
   *  2. Samplar VARJE vertex-UV i hela modellen (inte ett medelvärde) mot
   *     paletten, och räknar hur många vertexar som landar på varje
   *     distinkt färg — det är DEN listan som rapporteras uppåt, inte en
   *     gissning på vilken del som är vad.
   * Användaren pekar sedan själv ut i kontrollpanelen vilken upptäckt färg
   * som är hytten och vilken som är skåpet.
   */
  discoverPalette(root) {
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
        `${meshes.length} med UV:`,
      meshes.map((m) => m.name || '(namnlös)')
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

    // Sampla VARJE vertex-UV i hela modellen — inte ett medelvärde, som blir
    // meningslöst när en enda mesh (kaross) spänner över flera rutor.
    const rawCounts = {};
    let totalUVs = 0;
    for (const mesh of meshes) {
      forEachVertexUV(mesh.geometry, (u, v) => {
        const pixel = this.paletteTexture.samplePixel(u, v);
        const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
        rawCounts[hex] = (rawCounts[hex] || 0) + 1;
        totalUVs += 1;
      });
    }

    const palette = clusterColors(rawCounts);
    console.log(
      `[cassie:${this.id}] ${totalUVs} vertex-UV samplade, ${Object.keys(rawCounts).length} exakta färger, ` +
        `${palette.length} kluster efter tolerans. Palett (färg: antal vertexar):`
    );
    for (const { hex, count } of palette) {
      console.log(`  ${hex}: ${count}`);
    }

    this._onPaletteDiscovered?.(palette);

    // Applicera overrides som redan hunnit sättas (t.ex. från en inläst
    // sparad rutt) innan paletten var klar.
    this.applyColorOverrides();
  }

  applyColorOverrides() {
    if (!this.paletteTexture) return;
    const pairs = [
      ...computeGroupReplacementTargets(this.cabSources, this.cabColorOverride),
      ...computeGroupReplacementTargets(this.boxSources, this.boxColorOverride)
    ];
    this.paletteTexture.regenerate(pairs);
    this.requestRedraw();
  }

  /** @param {string[]} hexes Vilka UPPTÄCKTA originalfärger som tillhör hytten. */
  setCabSources(hexes) {
    this.cabSources = Array.isArray(hexes) ? hexes : [];
    this.applyColorOverrides();
  }

  /** @param {string | null} hex Ersättningsfärgen för hytten. Null = originalfärger. */
  setCabColor(hex) {
    this.cabColorOverride = hex || null;
    this.applyColorOverrides();
  }

  /** @param {string[]} hexes Vilka UPPTÄCKTA originalfärger som tillhör skåpet. */
  setBoxSources(hexes) {
    this.boxSources = Array.isArray(hexes) ? hexes : [];
    this.applyColorOverrides();
  }

  /** @param {string | null} hex Ersättningsfärgen för skåpet. Null = originalfärger. */
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
