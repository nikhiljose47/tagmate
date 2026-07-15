import { TestBed } from '@angular/core/testing';
import { BoundaryService } from './boundary.service';
import { MapTemplateStoreService } from './map-template-store.service';
import { MarkerService } from './marker.service';
import { MapControllerService } from './map-controller.service';
import {
  deviceStorageKey,
  removeLocalStorage,
  writeLocalStorage,
} from '../utils/local-storage.util';

describe('map persistence services', () => {
  const boundaryKey = deviceStorageKey('map-boundary-cache');
  const templateKey = deviceStorageKey('island-templates');

  beforeEach(() => {
    removeLocalStorage(boundaryKey);
    removeLocalStorage(templateKey);
    TestBed.configureTestingModule({
      providers: [BoundaryService, MapTemplateStoreService, MarkerService],
    });
  });

  afterEach(() => {
    removeLocalStorage(boundaryKey);
    removeLocalStorage(templateKey);
  });

  it('normalizes and retrieves cached boundaries', () => {
    const service = TestBed.inject(BoundaryService);
    const boundary = {
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 0],
          ],
        ],
      },
      bounds: [0, 0, 1, 1] as [number, number, number, number],
    };
    service.setCached('Downtown', boundary);

    expect(service.getCached('downtown')).toEqual(boundary);
  });

  it('filters invalid template values before returning them to the map', () => {
    writeLocalStorage(templateKey, [{ id: 'valid' }, { name: 'invalid' }]);
    const templates = TestBed.inject(MapTemplateStoreService).load(
      (value): value is { id: string } =>
        !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string',
    );

    expect(templates).toEqual([{ id: 'valid' }]);
  });

  it('converts markers to GeoJSON and updates an available source', () => {
    const source = { setData: jasmine.createSpy('setData') };
    const marker = { id: 'marker-1', longitude: 77.6, latitude: 12.9, title: 'Hello' };

    TestBed.inject(MarkerService).setSourceData(source as never, [marker], (value) => ({
      id: value.id,
      title: value.title,
    }));

    expect(source.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'marker-1', title: 'Hello' },
          geometry: { type: 'Point', coordinates: [77.6, 12.9] },
        },
      ],
    });
  });

  it('removes the previous map and observer before attaching a replacement', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const disconnect = jasmine.createSpy('disconnect');
    const observe = jasmine.createSpy('observe');
    class ResizeObserverMock {
      constructor(_callback: ResizeObserverCallback) {}
      observe = observe;
      disconnect = disconnect;
      unobserve(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    const firstMap = { remove: jasmine.createSpy('remove'), resize: jasmine.createSpy('resize') };
    const secondMap = { remove: jasmine.createSpy('remove'), resize: jasmine.createSpy('resize') };
    const container = document.createElement('div');
    const service = new MapControllerService();

    service.attach(firstMap as never, container);
    service.attach(secondMap as never, container);
    service.destroy();

    expect(firstMap.remove).toHaveBeenCalledTimes(1);
    expect(secondMap.remove).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenCalledTimes(2);
    globalThis.ResizeObserver = originalResizeObserver;
  });
});
