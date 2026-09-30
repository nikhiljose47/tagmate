import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, timer } from 'rxjs';

const FIRST_UPDATE_CHECK_MS = 60_000;
const UPDATE_CHECK_INTERVAL_MS = 10 * 60_000;

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  /** True only when the SW enters an unrecoverable state — triggers a manual-reload banner. */
  readonly updateReady = signal(false);
  readonly reloading = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.swUpdate?.isEnabled) return;

    // VERSION_READY: new version fully downloaded — perform a full reload immediately.
    // A full reload is required because lazy-loaded JS chunk filenames change between
    // deployments; activateUpdate() alone would leave stale chunk references in memory.
    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        console.info(
          '[AppUpdate] VERSION_READY — reloading.',
          'current:', event.currentVersion.hash,
          'latest:', event.latestVersion.hash,
        );
        this.hardReload();
      });

    // Unrecoverable SW state — cannot silently reload, show a banner instead so
    // the user is aware and can save work before refreshing.
    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        console.error('[AppUpdate] Service worker unrecoverable:', event.reason);
        this.updateReady.set(true);
      });

    timer(FIRST_UPDATE_CHECK_MS, UPDATE_CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());

    const onVisibility = () => {
      if (this.document.visibilityState === 'visible') void this.checkForUpdate();
    };
    this.document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  /** Called from the unrecoverable-state banner. */
  dismiss(): void {
    this.updateReady.set(false);
  }

  /** Called from the unrecoverable-state banner. */
  reload(): void {
    this.reloading.set(true);
    this.hardReload();
  }

  private hardReload(): void {
    const window = this.document.defaultView;
    if (!window) return;
    window.location.reload();
  }

  private async checkForUpdate(): Promise<void> {
    try {
      await this.swUpdate?.checkForUpdate();
    } catch {
      // A temporary network failure should not interrupt the current session.
    }
  }
}
