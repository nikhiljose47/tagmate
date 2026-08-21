import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { UserSessionService } from '../services/user-session.service';

/**
 * Business accounts that signed up with email confirmation required never got
 * to upload their shop photos (the files only existed in the signup page's
 * memory, gone by the time they confirm and log back in) — see
 * functions/api/auth and signup.ts's uploadShopImages(). This redirects those
 * accounts to a mandatory one-time catch-up screen until they add at least
 * one shop photo. `/business-photos` and `/profile` are exempt so there's
 * always a way to actually fix it.
 */
export const businessPhotosGuard: CanActivateFn = (_route, state) => {
  const session = inject(UserSessionService);
  const router = inject(Router);

  if (state.url.startsWith('/business-photos') || state.url.startsWith('/profile')) {
    return true;
  }

  return toObservable(session.user).pipe(
    filter((user) => user !== null),
    take(1),
    map((user) => {
      const needsPhotos =
        user!.accountType === 'business' && (user!.businessImages?.length ?? 0) < 1;
      return needsPhotos ? router.createUrlTree(['/business-photos']) : true;
    }),
  );
};
