import { Loader } from '@googlemaps/js-api-loader';
import { MapProvider } from './MapProvider.js';

// Den enda filen i repot som får importera eller referera google.maps.
// Se MapProvider.js för varför.

const DASH_ICON = {
  path: 'M 0,-1 0,1',
  strokeOpacity: 1,
  scale: 3
};

function toGoogleLatLng(point) {
  return { lat: point.lat, lng: point.lng };
}

function buildMarkerContent(label) {
  const wrap = document.createElement('div');
  wrap.className = 'cassie-marker';
  wrap.style.opacity = '0';
  wrap.style.transform = 'scale(0.6)';
  wrap.style.transition = 'opacity 300ms ease, transform 300ms ease';
  wrap.style.pointerEvents = 'none';

  const pin = document.createElement('div');
  pin.className = 'cassie-marker-pin';
  wrap.appendChild(pin);

  if (label) {
    const tag = document.createElement('div');
    tag.className = 'cassie-marker-label';
    tag.textContent = label;
    wrap.appendChild(tag);
  }

  return wrap;
}

export class GoogleMapProvider extends MapProvider {
  constructor() {
    super();
    this.map = null;
    this.mapsLib = null;
    this.markerLib = null;
    this.polylines = new Map();
    this.markers = new Map();
    this.internalOverlay = null;
    this.overlay = null;
  }

  async init(container, { styleMode = 'roadmap', gestureHandling = 'greedy' } = {}) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

    if (!apiKey || !mapId) {
      throw new Error(
        'VITE_GOOGLE_MAPS_API_KEY och VITE_GOOGLE_MAPS_MAP_ID måste sättas i frontend/.env — se DEPLOYMENT.md.'
      );
    }

    const loader = new Loader({ apiKey, version: 'weekly' });
    const [mapsLib, markerLib] = await Promise.all([
      loader.importLibrary('maps'),
      loader.importLibrary('marker')
    ]);
    const { Map } = mapsLib;
    this.mapsLib = mapsLib;
    this.markerLib = markerLib;

    this.map = new Map(container, {
      mapId,
      center: { lat: 59.334, lng: 18.063 },
      zoom: 5,
      heading: 0,
      tilt: 0,
      disableDefaultUI: true,
      gestureHandling,
      mapTypeId: styleMode === 'satellite' ? 'satellite' : 'roadmap',
      keyboardShortcuts: false
    });
  }

  setGestureHandling(mode) {
    this.map?.setOptions({ gestureHandling: mode });
  }

  setStyle(mode) {
    if (!this.map) return;
    this.map.setMapTypeId(mode === 'satellite' ? 'satellite' : 'roadmap');
  }

  moveCamera({ lat, lng, zoom, heading, tilt }) {
    if (!this.map) return;
    this.map.moveCamera({
      center: { lat, lng },
      zoom: zoom ?? this.map.getZoom?.() ?? 5,
      heading: heading ?? this.map.getHeading?.() ?? 0,
      tilt: tilt ?? this.map.getTilt?.() ?? 0
    });
  }

  fitBounds(bbox, padding) {
    if (!this.map) return;
    const bounds = {
      north: bbox.north,
      south: bbox.south,
      east: bbox.east,
      west: bbox.west
    };
    this.map.fitBounds(bounds, padding);
  }

  addPolyline(id, opts) {
    if (!this.map) return;
    this.removePolyline(id);

    const path = (opts.path || []).map(toGoogleLatLng);
    const config = {
      map: this.map,
      path,
      strokeColor: opts.strokeColor || '#3b82f6',
      strokeWeight: opts.strokeWeight ?? 4,
      strokeOpacity: opts.dashed ? 0 : opts.strokeOpacity ?? 0.9,
      zIndex: opts.zIndex ?? 1,
      clickable: false
    };

    if (opts.dashed) {
      config.icons = [
        {
          icon: { ...DASH_ICON, strokeOpacity: opts.strokeOpacity ?? 0.6 },
          offset: '0',
          repeat: '18px'
        }
      ];
    }

    const polyline = new this.mapsLib.Polyline(config);
    this.polylines.set(id, polyline);
  }

  setPolylinePath(id, coords) {
    const polyline = this.polylines.get(id);
    if (!polyline) return;
    polyline.setPath((coords || []).map(toGoogleLatLng));
  }

  removePolyline(id) {
    const polyline = this.polylines.get(id);
    if (!polyline) return;
    polyline.setMap(null);
    this.polylines.delete(id);
  }

  addMarker(id, { lat, lng, label }) {
    if (!this.map || !this.markerLib) return;
    this.removeMarker(id);

    const content = buildMarkerContent(label);
    const marker = new this.markerLib.AdvancedMarkerElement({
      map: this.map,
      position: { lat, lng },
      content,
      title: label || ''
    });

    this.markers.set(id, { marker, content });
  }

  setMarkerOpacity(id, opacity) {
    const entry = this.markers.get(id);
    if (!entry) return;
    const clamped = Math.max(0, Math.min(1, opacity));
    entry.content.style.opacity = String(clamped);
    entry.content.style.transform = `scale(${0.6 + 0.4 * clamped})`;
  }

  removeMarker(id) {
    const entry = this.markers.get(id);
    if (!entry) return;
    entry.marker.map = null;
    this.markers.delete(id);
  }

  attachOverlay(overlay) {
    if (!this.map || !this.mapsLib) return;
    if (this.internalOverlay) {
      this.internalOverlay.setMap(null);
      this.internalOverlay = null;
    }

    const { WebGLOverlayView } = this.mapsLib;

    class InternalOverlay extends WebGLOverlayView {
      onAdd() {
        overlay.onAdd?.();
      }

      onContextRestored(options) {
        overlay.onContextRestored?.(options);
      }

      onContextLost() {
        overlay.onContextLost?.();
      }

      onDraw(options) {
        overlay.onDraw?.(options);
      }

      onRemove() {
        overlay.onRemove?.();
      }
    }

    const internal = new InternalOverlay();
    overlay._requestRedraw = () => internal.requestRedraw();
    internal.setMap(this.map);

    this.internalOverlay = internal;
    this.overlay = overlay;
  }

  destroy() {
    for (const id of Array.from(this.polylines.keys())) this.removePolyline(id);
    for (const id of Array.from(this.markers.keys())) this.removeMarker(id);
    if (this.internalOverlay) {
      this.internalOverlay.setMap(null);
      this.internalOverlay = null;
    }
    this.overlay = null;
    this.map = null;
  }
}

export default GoogleMapProvider;
