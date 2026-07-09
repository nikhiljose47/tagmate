import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';
import { TelemetryService } from '../services/telemetry.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    const message = this.extractMessage(error);
    this.logger.error('Uncaught application error', error);
    this.telemetry.captureException(error, { message });

    if (typeof window !== 'undefined' && 'reportError' in window) {
      window.reportError(error);
    }
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'An unknown error occurred';
  }
}
