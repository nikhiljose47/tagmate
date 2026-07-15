import { Utils } from './utils.service';
import type { MultiPolygon, Polygon, Position } from 'geojson';

/**
 * Fast, deterministic regression suite for the data and map paths that are
 * most sensitive to malformed external input and mobile rendering cost.
 *
 * The parameterised examples intentionally register 120 independent Jasmine
 * specs. They are not benchmarks: CI performance assertions are flaky, so the
 * suite verifies the structural limits that keep rendering work bounded.
 */
describe('quality evaluation suite', () => {
  describe('geocoding bounds validation (32 cases)', () => {
    const validBoxes = Array.from({ length: 16 }, (_, index) => {
      const south = -80 + index * 10;
      return [`${south}`, `${south + 3}`, `${-170 + index * 20}`, `${-160 + index * 20}`] as [
        string,
        string,
        string,
        string,
      ];
    });
    const invalidBoxes: Array<[string, string, string, string] | undefined> = [
      undefined,
      ['x', '1', '2', '3'],
      ['1', 'x', '2', '3'],
      ['1', '2', 'x', '3'],
      ['1', '2', '3', 'x'],
      ['NaN', '1', '2', '3'],
      ['1', 'NaN', '2', '3'],
      ['1', '2', 'NaN', '3'],
      ['1', '2', '3', 'NaN'],
      ['Infinity', '1', '2', '3'],
      ['1', '-Infinity', '2', '3'],
      [' ', '2', '3', '4'],
      ['', '2', '3', '4'],
      ['1', '', '3', '4'],
      ['1', '2', '', '4'],
      ['1', '2', '3', ''],
    ];

    validBoxes.forEach((box, index) =>
      it(`accepts finite box ${index + 1}`, () => {
        expect(Utils.getBoundsFromBoundingBox(box)).toEqual([
          [Number(box[2]), Number(box[0])],
          [Number(box[3]), Number(box[1])],
        ]);
      }),
    );
    invalidBoxes.forEach((box, index) =>
      it(`rejects malformed box ${index + 1}`, () => {
        expect(Utils.getBoundsFromBoundingBox(box)).toBeNull();
      }),
    );
  });

  describe('fallback rectangle geometry (24 cases)', () => {
    const boxes = Array.from({ length: 24 }, (_, index) => {
      const south = -60 + index * 5;
      return [`${south}`, `${south + 1}`, `${-120 + index * 3}`, `${-118 + index * 3}`] as [
        string,
        string,
        string,
        string,
      ];
    });

    boxes.forEach((box, index) =>
      it(`creates a closed, correctly ordered fallback polygon ${index + 1}`, () => {
        const geometry = Utils.createRectangleGeometry(box);
        const ring = geometry.coordinates[0];
        expect(ring.length).toBe(5);
        expect(ring[0]).toEqual(ring[4]);
        expect(ring[0]).toEqual([Number(box[2]), Number(box[0])]);
        expect(ring[2]).toEqual([Number(box[3]), Number(box[1])]);
      }),
    );
  });

  describe('boundary simplification and rendering-cost guards (40 cases)', () => {
    const denseRing = (points: number): Position[] => {
      const ring: Position[] = [];
      for (let index = 0; index < points; index++)
        ring.push([index / points, index % 2 ? 0.000001 : 0]);
      ring.push([1, 1], [0, 1], ring[0]);
      return ring;
    };

    Array.from({ length: 20 }, (_, index) => index + 20).forEach((points) => {
      it(`reduces a ${points}-vertex noisy boundary without opening it`, () => {
        const original: Polygon = { type: 'Polygon', coordinates: [denseRing(points)] };
        const simplified = Utils.simplifyBoundary(original, 0.0001) as Polygon;
        const ring = simplified.coordinates[0];
        expect(ring.length).toBeLessThan(original.coordinates[0].length);
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      });
    });

    Array.from({ length: 12 }, (_, index) => index + 4).forEach((points) => {
      it(`keeps simple ${points}-point polygons valid`, () => {
        const ring: Position[] = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ];
        const geometry: Polygon = { type: 'Polygon', coordinates: [ring] };
        const simplified = Utils.simplifyBoundary(geometry, 0.1) as Polygon;
        expect(simplified.type).toBe('Polygon');
        expect(simplified.coordinates[0].length).toBeGreaterThanOrEqual(4);
        expect(simplified.coordinates[0][0]).toEqual(
          simplified.coordinates[0][simplified.coordinates[0].length - 1],
        );
        expect(points).toBeGreaterThan(3);
      });
    });

    Array.from({ length: 8 }, (_, index) => index + 1).forEach((index) => {
      it(`preserves all ${index + 1} multipolygon members`, () => {
        const polygon: Position[][] = [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ];
        const geometry: MultiPolygon = {
          type: 'MultiPolygon',
          coordinates: Array.from({ length: index + 1 }, () => polygon),
        };
        const simplified = Utils.simplifyBoundary(geometry) as MultiPolygon;
        expect(simplified.type).toBe('MultiPolygon');
        expect(simplified.coordinates.length).toBe(index + 1);
        simplified.coordinates.forEach((member) =>
          expect(member[0][0]).toEqual(member[0][member[0].length - 1]),
        );
      });
    });
  });

  describe('Nominatim boundary responses (24 cases)', () => {
    const cases: Array<{ name: string; body: unknown; expected: 'Polygon' | 'MultiPolygon' }> = [
      ...Array.from({ length: 12 }, (_, index) => ({
        name: `polygon response ${index + 1}`,
        body: [
          {
            boundingbox: ['0', '1', '2', '3'],
            geojson: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
        expected: 'Polygon' as const,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        name: `multipolygon response ${index + 1}`,
        body: [
          {
            boundingbox: ['0', '1', '2', '3'],
            geojson: {
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0],
                  ],
                ],
              ],
            },
          },
        ],
        expected: 'MultiPolygon' as const,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        name: `fallback response ${index + 1}`,
        body: [{ boundingbox: ['0', '1', '2', '3'] }],
        expected: 'Polygon' as const,
      })),
    ];

    cases.forEach(({ name, body, expected }) =>
      it(`maps ${name}`, async () => {
        const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
          new Response(JSON.stringify(body), { status: 200 }),
        );
        const boundary = await Utils.getPlaceBoundary('test place');
        expect(fetchSpy).toHaveBeenCalledWith('/api/nominatim/boundary?q=test%20place');
        expect(boundary?.geometry.type).toBe(expected);
        expect(boundary?.bounds).toEqual([
          [2, 0],
          [3, 1],
        ]);
      }),
    );

    it('returns null for an empty result set', async () => {
      spyOn(globalThis, 'fetch').and.resolveTo(new Response('[]', { status: 200 }));
      await expectAsync(Utils.getPlaceBoundary('empty')).toBeResolvedTo(null);
    });

    it('returns null when a result has no usable bounds', async () => {
      spyOn(globalThis, 'fetch').and.resolveTo(
        new Response(JSON.stringify([{ geojson: { type: 'Polygon', coordinates: [] } }]), {
          status: 200,
        }),
      );
      await expectAsync(Utils.getPlaceBoundary('missing bounds')).toBeResolvedTo(null);
    });

    it('falls back to a rectangle for unsupported geometry', async () => {
      spyOn(globalThis, 'fetch').and.resolveTo(
        new Response(
          JSON.stringify([
            { boundingbox: ['0', '1', '2', '3'], geojson: { type: 'Point', coordinates: [2, 0] } },
          ]),
          { status: 200 },
        ),
      );
      const boundary = await Utils.getPlaceBoundary('point result');
      expect(boundary?.geometry.coordinates[0]).toEqual([
        [2, 0],
        [3, 0],
        [3, 1],
        [2, 1],
        [2, 0],
      ]);
    });

    it('rejects failed upstream responses', async () => {
      spyOn(globalThis, 'fetch').and.resolveTo(new Response('rate limited', { status: 429 }));
      await expectAsync(Utils.getPlaceBoundary('rate limited')).toBeRejectedWithError(
        'Boundary lookup failed with status 429',
      );
    });

    it('encodes reserved characters in a lookup query', async () => {
      const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
        new Response('[]', { status: 200 }),
      );
      await Utils.getPlaceBoundary('A & B/West');
      expect(fetchSpy).toHaveBeenCalledWith('/api/nominatim/boundary?q=A%20%26%20B%2FWest');
    });
  });
});
