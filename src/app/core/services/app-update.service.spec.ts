import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;

  beforeEach(() => {
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();

    TestBed.configureTestingModule({
      providers: [
        AppUpdateService,
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            unrecoverable,
            checkForUpdate: jasmine.createSpy('checkForUpdate').and.resolveTo(false),
          },
        },
      ],
    });
  });

  it('shows the notice when a downloaded version is ready', () => {
    const service = TestBed.inject(AppUpdateService);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(service.updateReady()).toBeTrue();
  });

  it('allows the notice to be dismissed', () => {
    const service = TestBed.inject(AppUpdateService);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    service.dismiss();

    expect(service.updateReady()).toBeFalse();
  });

  it('requests a refresh when the current version is unrecoverable', () => {
    const service = TestBed.inject(AppUpdateService);

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'Missing cached asset' });

    expect(service.updateReady()).toBeTrue();
  });
});
