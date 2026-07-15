import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const status = err.status;
        const url = req.url;

        switch (true) {
          case status === 0:
            logger.error('Network error — no connection or CORS', err, { url });
            break;
          case status === 401:
            logger.warn('Unauthorised request', { url, status });
            break;
          case status === 403:
            logger.warn('Forbidden request', { url, status });
            break;
          case status >= 500:
            logger.error('Server error', err, { url, status });
            break;
          default:
            logger.warn('HTTP error', { url, status });
        }
      }
      return throwError(() => err);
    }),
  );
};
