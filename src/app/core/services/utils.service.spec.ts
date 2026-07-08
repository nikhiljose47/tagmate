import { Utils } from './utils.service';

describe('Utils', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  it('returns a cleanup function for random popups', () => {
    const utils = new Utils();
    const seen: unknown[][] = [];
    const sub = utils.cards$.subscribe((cards) => seen.push(cards));

    utils.setAllCards(['a']);
    const stop = utils.startRandomPopup(100);
    jasmine.clock().tick(100);

    expect(seen.at(-1)).toEqual(['a']);

    stop();
    jasmine.clock().tick(300);

    expect(seen.at(-1)).toEqual(['a']);
    sub.unsubscribe();
  });

  it('returns a cleanup function for timers', () => {
    const utils = new Utils();
    const onTick = jasmine.createSpy('onTick');
    const onComplete = jasmine.createSpy('onComplete');

    const stop = utils.startTimer(3, onTick, onComplete);
    jasmine.clock().tick(1000);
    stop();
    jasmine.clock().tick(3000);

    expect(onTick).toHaveBeenCalledOnceWith(2);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
