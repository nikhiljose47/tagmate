import { placeCode } from './state-codes';

describe('placeCode', () => {
  it('uses the familiar Kerala code', () => {
    expect(placeCode('Kerala')).toBe('KL');
  });

  it('derives a compact fallback for an unmapped place', () => {
    expect(placeCode('Example Region')).toBe('ER');
  });
});
