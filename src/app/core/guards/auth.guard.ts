import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.session$.pipe(
    take(1),
    map((session) => (session ? true : router.createUrlTree(['/login']))),
  );
};

/** Only trusted Auth app_metadata may grant administration privileges. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.session$.pipe(
    take(1),
    map((session) =>
      session?.user.app_metadata?.['role'] === 'admin' ? true : router.createUrlTree(['/feed']),
    ),
  );
};
