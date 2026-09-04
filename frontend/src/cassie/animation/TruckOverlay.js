import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groundMetersPerPixel } from './routeMath.js';

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
// Modellens "framåt" pekade bakåt längs rutten med 0 — glTF-tillgången är
// alltså byggd vänd åt andra hållet. 180° vänder den rätt.
const MODEL_YAW_TRIM_DEG = 180;
// Ungefärlig egen storlek (meter) hos modellen vid scale=1. Det här är
// kalibreringskonstanten mellan "pixlar på skärmen" (regeln användaren styr)
// och glTF-filens egna, okända enheter — justera om storleksreglaget känns
// fel skalat (t.ex. om hela intervallet blir för stort/litet).
const MODEL_UNIT_SIZE_METERS = 8;
// Standardvärde innan CassiePage hunnit sätta ett från URL-state.
const DEFAULT_PIXEL_SIZE = 90;

export class TruckOverlay {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.headingGroup = null;
    this.bankGroup = null;
    this.modelGroup = null;
    this.pose = { lat: 0, lng: 0, headingDeg: 0, bankDeg: 0 };
    this.pixelSize = DEFAULT_PIXEL_SIZE;
    this.visible = true;
    this.loaded = false;
    // Sätts av GoogleMapProvider.attachOverlay — enda kopplingen ut mot
    // kartmotorn, och den är opaque (bara en callback, ingen typreferens).
    this._requestRedraw = null;
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

    this.headingGroup = new THREE.Group();
    this.bankGroup = new THREE.Group();
    this.modelGroup = new THREE.Group();

    this.bankGroup.add(this.modelGroup);
    this.headingGroup.add(this.bankGroup);
    this.scene.add(this.headingGroup);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        // Rätar upp modellen från glTF:s Y-upp till den lokala Z-upp som
        // transformern använder. Den faktiska skärmstorleken sätts per
        // bildruta i onDraw, på modelGroup — inte här.
        model.rotation.x = Math.PI / 2;
        model.rotation.z = THREE.MathUtils.degToRad(MODEL_YAW_TRIM_DEG);
        this.modelGroup.add(model);
        this.loaded = true;
        this.requestRedraw();
      },
      undefined,
      (err) => console.error('[cassie] kunde inte ladda truck.glb:', err)
    );
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
    this.scene = null;
    this.camera = null;
  }

  requestRedraw() {
    this._requestRedraw?.();
  }
}

export default TruckOverlay;
