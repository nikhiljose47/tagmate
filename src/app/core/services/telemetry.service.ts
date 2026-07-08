import { Injectable, inject, isDevMode } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class TelemetryService {
  private readonly logger = inject(LoggerService);

  /**
   * Capture and report an exception to active telemetry backends (Sentry / LogRocket)
   * in production mode.
   */
  captureException(error: unknown, context?: Record<string, unknown>): void {
    this.logger.error('Telemetry captureException:', error, context);

    if (isDevMode()) {
      this.logger.debug('Telemetry reports are skipped in development mode.');
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const win = window as any;

    // Report to Sentry if initialized via CDN/global window object
    if (win.Sentry && typeof win.Sentry.captureException === 'function') {
      try {
        win.Sentry.captureException(error, context ? { extra: context } : undefined);
      } catch (err) {
        this.logger.warn('Failed to send error to Sentry:', err);
      }
    }

    // Report to LogRocket if initialized via CDN/global window object
    if (win.LogRocket && typeof win.LogRocket.captureException === 'function') {
      try {
        win.LogRocket.captureException(error as Error, context ? { extra: context } : undefined);
      } catch (err) {
        this.logger.warn('Failed to send error to LogRocket:', err);
      }
    }
  }

  /**
   * Log a message to telemetry backends.
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>): void {
    this.logger.info(`Telemetry captureMessage [${level}]: ${message}`, context);

    if (isDevMode()) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const win = window as any;

    // Send message to Sentry
    if (win.Sentry && typeof win.Sentry.captureMessage === 'function') {
      try {
        win.Sentry.captureMessage(message, {
          level: level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info',
          extra: context,
        });
      } catch (err) {
        this.logger.warn('Failed to send message to Sentry:', err);
      }
    }

    // Send message to LogRocket
    if (win.LogRocket && typeof win.LogRocket.log === 'function') {
      try {
        win.LogRocket.log(message, context);
      } catch (err) {
        this.logger.warn('Failed to send message to LogRocket:', err);
      }
    }
  }
}
