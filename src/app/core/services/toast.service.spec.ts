import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows a toast with defaults and dismisses it after its duration', () => {
    service.show('Saved');

    expect(service.message()).toEqual({ id: 1, text: 'Saved', tone: 'info', durationMs: 3600 });

    jasmine.clock().tick(3600);
    expect(service.message()).toBeNull();
  });

  it('queues messages and advances when the current toast is dismissed', () => {
    service.show('First', 'success', 1000);
    service.show('Second', 'warning', 2000);

    expect(service.message()?.text).toBe('First');

    service.dismiss();
    expect(service.message()).toEqual({
      id: 2,
      text: 'Second',
      tone: 'warning',
      durationMs: 2000,
    });

    jasmine.clock().tick(1000);
    expect(service.message()?.text).toBe('Second');

    jasmine.clock().tick(1000);
    expect(service.message()).toBeNull();
  });
});
