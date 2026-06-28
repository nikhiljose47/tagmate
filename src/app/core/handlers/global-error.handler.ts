import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly zone = inject(NgZone);

  handleError(error: unknown): void {
    const message = this.extractMessage(error);
    this.zone.run(() => {
      this.logger.error('Uncaught application error', error);
    });

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
