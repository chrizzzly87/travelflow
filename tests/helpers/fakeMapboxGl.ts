/**
 * A stand-in for the `mapbox-gl` module, for tests that render a real Mapbox
 * surface in jsdom. It records camera calls and keeps sources, layers and DOM
 * markers, which is all the trip map touches.
 *
 * Use it with:
 *   vi.mock('mapbox-gl', async () => ({ default: (await import('../helpers/fakeMapboxGl')).fakeMapboxModule }));
 */

type Handler = (payload?: unknown) => void;

interface FakeCameraTarget {
  center?: [number, number];
  zoom?: number;
}

export class FakeMapboxMap {
  static instances: FakeMapboxMap[] = [];
  /** Off to keep a map stuck before its first load, e.g. to fail it there. */
  static autoLoad = true;

  readonly options: Record<string, unknown>;
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly sources = new Map<string, unknown>();
  readonly layers = new Map<string, { id: string; source?: string }>();
  readonly fitBoundsCalls: unknown[][] = [];
  readonly easeToCalls: FakeCameraTarget[] = [];
  readonly jumpToCalls: FakeCameraTarget[] = [];
  readonly flyToCalls: FakeCameraTarget[] = [];
  zoom: number;
  center: { lng: number; lat: number };
  styleLoaded = false;
  removed = false;
  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.container = options.container as HTMLElement;
    this.canvas = document.createElement('canvas');
    const center = (options.center as [number, number] | undefined) ?? [0, 0];
    this.center = { lng: center[0], lat: center[1] };
    this.zoom = typeof options.zoom === 'number' ? options.zoom : 0;
    FakeMapboxMap.instances.push(this);
    if (!FakeMapboxMap.autoLoad) return;
    window.setTimeout(() => {
      if (this.removed) return;
      this.styleLoaded = true;
      this.emit('style.load');
      this.emit('load');
    }, 0);
  }

  static latest(): FakeMapboxMap | undefined {
    return FakeMapboxMap.instances[FakeMapboxMap.instances.length - 1];
  }

  static reset(): void {
    FakeMapboxMap.instances.length = 0;
    FakeMapboxMap.autoLoad = true;
  }

  /** Every camera call, in one list, so a test can assert "none at all". */
  get cameraCallCount(): number {
    return this.fitBoundsCalls.length + this.easeToCalls.length + this.jumpToCalls.length + this.flyToCalls.length;
  }

  on(type: string, handler: Handler) {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return this;
  }

  off(type: string, handler: Handler) {
    this.handlers.get(type)?.delete(handler);
    return this;
  }

  once(type: string, handler: Handler) {
    const wrapped: Handler = (payload) => {
      this.off(type, wrapped);
      handler(payload);
    };
    return this.on(type, wrapped);
  }

  emit(type: string, payload?: unknown) {
    [...(this.handlers.get(type) ?? [])].forEach((handler) => handler(payload));
  }

  private applyCamera(target: FakeCameraTarget) {
    if (target.center) this.center = { lng: target.center[0], lat: target.center[1] };
    if (typeof target.zoom === 'number') {
      this.zoom = target.zoom;
      this.emit('zoom');
    }
  }

  getZoom() { return this.zoom; }
  setZoom(zoom: number) {
    this.applyCamera({ zoom });
    return this;
  }
  getCenter() { return this.center; }
  getBounds() { return { contains: () => true }; }
  fitBounds(...args: unknown[]) {
    this.fitBoundsCalls.push(args);
    return this;
  }
  easeTo(target: FakeCameraTarget) {
    this.easeToCalls.push(target);
    this.applyCamera(target);
    return this;
  }
  jumpTo(target: FakeCameraTarget) {
    this.jumpToCalls.push(target);
    this.applyCamera(target);
    return this;
  }
  flyTo(target: FakeCameraTarget) {
    this.flyToCalls.push(target);
    this.applyCamera(target);
    return this;
  }
  cameraForBounds() { return { center: [this.center.lng, this.center.lat], zoom: 4 }; }
  isMoving() { return false; }
  resize() { return this; }
  isStyleLoaded() { return this.styleLoaded; }
  getStyle() { return this.removed ? undefined : { layers: [] }; }
  getContainer() { return this.container; }
  getCanvasContainer() { return this.container; }
  getCanvas() { return this.canvas; }
  project() { return { x: 10, y: 10 }; }
  setStyle() { return this; }
  setProjection() { return this; }
  setFog() { return this; }
  setTerrain() { return this; }
  setPitch() { return this; }
  getPitch() { return 0; }
  setFilter() { return this; }
  setLayoutProperty() { return this; }
  setPaintProperty() { return this; }
  addSource(id: string, source: unknown) {
    this.sources.set(id, source);
    return this;
  }
  getSource(id: string) { return this.sources.get(id); }
  removeSource(id: string) {
    this.sources.delete(id);
    return this;
  }
  addLayer(layer: { id: string; source?: string }) {
    this.layers.set(layer.id, layer);
    return this;
  }
  getLayer(id: string) { return this.layers.get(id); }
  removeLayer(id: string) {
    this.layers.delete(id);
    return this;
  }
  remove() {
    this.removed = true;
  }
}

export class FakeMapboxMarker {
  readonly element: HTMLElement;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
  }

  setLngLat() { return this; }

  addTo(map: FakeMapboxMap) {
    map.getContainer().appendChild(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    return this;
  }
}

export const fakeMapboxModule = {
  Map: FakeMapboxMap,
  Marker: FakeMapboxMarker,
  accessToken: '',
};
