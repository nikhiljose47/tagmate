import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LoggerService } from '../services/logger.service';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const started = Date.now();

  logger.debug(`→ ${req.method} ${req.url}`);

  return next(req).pipe(
    tap({
      next: () => logger.debug(`← ${req.method} ${req.url} (${Date.now() - started}ms)`),
      error: (err) => logger.warn(`✗ ${req.method} ${req.url} (${Date.now() - started}ms)`, err),
    }),
  );
};
