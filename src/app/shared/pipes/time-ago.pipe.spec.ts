import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  let pipe: TimeAgoPipe;

  beforeEach(() => { pipe = new TimeAgoPipe(); });

  it('returns "just now" for null/undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('returns "just now" for a very recent date', () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(pipe.transform(recent)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMin = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(pipe.transform(fiveMin)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const twoHours = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(pipe.transform(twoHours)).toBe('2h ago');
  });

  it('returns days ago', () => {
    const threeDays = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(pipe.transform(threeDays)).toBe('3d ago');
  });

  it('returns formatted date for old dates', () => {
    const old = new Date('2024-01-15T10:00:00Z').toISOString();
    const result = pipe.transform(old);
    expect(result).toMatch(/Jan/i);
  });
});
