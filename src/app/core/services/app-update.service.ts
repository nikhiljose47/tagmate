import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, timer } from 'rxjs';

const FIRST_UPDATE_CHECK_MS = 60_000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000;

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  readonly updateReady = signal(false);
  readonly reloading = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.swUpdate?.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateReady.set(true));

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateReady.set(true));

    timer(FIRST_UPDATE_CHECK_MS, UPDATE_CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());
  }

  dismiss(): void {
    this.updateReady.set(false);
  }

  reload(): void {
    const window = this.document.defaultView;
    if (!window) return;

    this.reloading.set(true);
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
