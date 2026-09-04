/**
 * MapProvider — det enda kontraktet resten av Cassie-koden känner till.
 *
 * Google-specifika villkor tillåter att Google-data (rutter, kartplattor,
 * markörer) ritas ovanpå en Google-karta, men aldrig att Google-data ritas
 * ovanpå en icke-Google-karta. Genom att låsa ALL kartlogik bakom detta
 * interface blir ett framtida byte till t.ex. MapLibre en fråga om att
 * skriva en ny *MapProvider-implementation, inte om att skriva om
 * animationskärnan, UI:t eller ruttmatematiken.
 *
 * GoogleMapProvider.js är den enda filen i repot som får importera eller
 * referera `google.maps`. Om du behöver en Google-specifik typ eller
 * kontrollstruktur någon annanstans ligger logiken på fel ställe.
 *
 * Alla koordinater i detta interface är enkla { lat, lng }-objekt (aldrig
 * ett SDK-specifikt LatLng-objekt), så anroparen behöver aldrig veta vilken
 * kart-SDK som ligger bakom.
 *
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{ north: number, south: number, east: number, west: number }} BBox
 * @typedef {{ lat: number, lng: number, zoom?: number, heading?: number, tilt?: number }} CameraState
 * @typedef {{ top?: number, right?: number, bottom?: number, left?: number } | number} Padding
 *
 * @typedef {Object} PolylineOptions
 * @property {LatLng[]} path
 * @property {string} [strokeColor]
 * @property {number} [strokeWeight]
 * @property {number} [strokeOpacity]
 * @property {boolean} [dashed]
 * @property {number} [zIndex]
 *
 * @typedef {Object} MapOverlay
 * @property {(gl: WebGLRenderingContext) => void} [onContextRestored]
 * @property {() => void} [onContextLost]
 * @property {(args: { gl: WebGLRenderingContext, transformer: unknown }) => void} onDraw
 * @property {() => void} [onRemove]
 */
export class MapProvider {
  /**
   * @param {HTMLElement} container
   * @param {{ styleMode: 'roadmap' | 'satellite' }} options
   * @returns {Promise<void>}
   */
  async init(container, options) {
    throw new Error('MapProvider.init är inte implementerad');
  }

  /** @param {'roadmap' | 'satellite'} mode */
  setStyle(mode) {
    throw new Error('MapProvider.setStyle är inte implementerad');
  }

  /** @param {CameraState} camera */
  moveCamera(camera) {
    throw new Error('MapProvider.moveCamera är inte implementerad');
  }

  /**
   * @param {BBox} bbox
   * @param {Padding} [padding]
   */
  fitBounds(bbox, padding) {
    throw new Error('MapProvider.fitBounds är inte implementerad');
  }

  /**
   * @param {string} id
   * @param {PolylineOptions} opts
   */
  addPolyline(id, opts) {
    throw new Error('MapProvider.addPolyline är inte implementerad');
  }

  /**
   * @param {string} id
   * @param {LatLng[]} coords
   */
  setPolylinePath(id, coords) {
    throw new Error('MapProvider.setPolylinePath är inte implementerad');
  }

  /** @param {string} id */
  removePolyline(id) {
    throw new Error('MapProvider.removePolyline är inte implementerad');
  }

  /**
   * @param {string} id
   * @param {{ lat: number, lng: number, label?: string, draggable?: boolean, onDragEnd?: (pos: LatLng) => void }} opts
   */
  addMarker(id, opts) {
    throw new Error('MapProvider.addMarker är inte implementerad');
  }

  /**
   * @param {string} id
   * @param {number} opacity 0..1
   */
  setMarkerOpacity(id, opacity) {
    throw new Error('MapProvider.setMarkerOpacity är inte implementerad');
  }

  /** @param {string} id */
  removeMarker(id) {
    throw new Error('MapProvider.removeMarker är inte implementerad');
  }

  /** @param {MapOverlay} overlay */
  attachOverlay(overlay) {
    throw new Error('MapProvider.attachOverlay är inte implementerad');
  }

  /**
   * Registrerar en klick-lyssnare på kartan (för klick-för-att-placera
   * start/mål). Returnerar en avregistreringsfunktion.
   * @param {(point: LatLng) => void} callback
   * @returns {() => void}
   */
  onMapClick(callback) {
    throw new Error('MapProvider.onMapClick är inte implementerad');
  }

  /**
   * Stänger av/sätter på kartans egna pekgester. Används för att göra kartan
   * helt inert under uppspelning (inspelningsläge).
   * @param {'greedy' | 'none'} mode
   */
  setGestureHandling(mode) {
    throw new Error('MapProvider.setGestureHandling är inte implementerad');
  }

  destroy() {
    throw new Error('MapProvider.destroy är inte implementerad');
  }
}

export default MapProvider;
