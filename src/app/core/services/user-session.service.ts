import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom, Observable, of, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AppUser } from '../models/app-user.model';
import { Hood } from '../models/hood.model';
import { UserModel } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
import { SupabaseService } from './supabase.service';
import { toAppError } from '../models/app-error.model';
import { setUserPreference } from '../../store/user-preferences/user-preference.actions';

export interface HomeHoodInput {
  state: string;
  country: string;
  district: string;
  place?: string;
  lat?: number;
  lng?: number;
}

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private supabase = inject(SupabaseService);
  private store = inject(Store);

  user = signal<AppUser | null>(null);

  // Backward compatibility user$ observable for legacy components
  readonly user$: Observable<UserModel> = toObservable(this.user).pipe(
    map((u) =>
      u
        ? {
            uid: u.uid,
            email: u.email ?? null,
            username: u.name,
            isGuest: u.isGuest,
          }
        : {
            uid: 'guest',
            email: null,
            username: 'Guest',
            isGuest: true,
          },
    ),
  );

  constructor() {
    this.supabase.session$
      .pipe(
        switchMap((session) => {
          if (!session?.user) {
            return of(null);
          }

          const uid = session.user.id;
          const name =
            (session.user.user_metadata?.['username'] as string | undefined) ??
            session.user.email?.split('@')[0] ??
            'User';
          const isGuest = session.user.is_anonymous ?? false;
          const fallbackUser: AppUser = {
            uid,
            name,
            isGuest,
            email: session.user.email ?? undefined,
          };

          const metaHood = session.user.user_metadata?.['home_hood'] as
            | HomeHoodInput
            | undefined;

          return this.supabase.getUserById(uid).pipe(
            switchMap((appUser) => {
              if (appUser) {
                return of({ ...appUser, email: session.user.email ?? undefined });
              }

              // First-authenticated-session insert. If metadata carries a hood
              // (signup path), persist it now — otherwise fall back to Marathahalli
              // so the NOT NULL constraint is satisfied.
              const hoodRow = metaHood
                ? {
                    home_state: metaHood.state,
                    home_country: metaHood.country,
                    home_district: metaHood.district,
                    home_place: metaHood.place ?? null,
                    home_lat: metaHood.lat ?? null,
                    home_lng: metaHood.lng ?? null,
                  }
                : {
                    home_state: 'Karnataka',
                    home_country: 'India',
                    home_district: 'Bangalore Urban',
                    home_place: 'Marathahalli',
                    home_lat: 12.952,
                    home_lng: 77.7,
                  };
              return from(
                this.supabase.upsertRow('users', {
                  uid,
                  name,
                  is_guest: isGuest,
                  email: session.user.email ?? null,
                  created_at: new Date().toISOString(),
                  ...hoodRow,
                }),
              ).pipe(
                map(() => ({
                  ...fallbackUser,
                  hood: new Hood({
                    name: hoodRow.home_place || hoodRow.home_district || hoodRow.home_state,
                    state: hoodRow.home_state,
                    country: hoodRow.home_country,
                    district: hoodRow.home_district,
                    place: hoodRow.home_place || '',
                    coords: {
                      lat: hoodRow.home_lat ?? 0,
                      lng: hoodRow.home_lng ?? 0,
                    },
                    updatedAt: new Date().toISOString(),
                  }),
                })),
              );
            }),
            catchError(() => of(fallbackUser)),
          );
        }),
      )
      .subscribe((appUser) => {
        this.user.set(appUser);
        if (appUser?.hood) {
          this.store.dispatch(setUserPreference({ pref: { hood: appUser.hood } }));
        }
      });
  }

  /**
   * Update the home hood in Supabase. Rejects when the DB trigger determines
   * the last change was less than 30 days ago (error message contains
   * `HOME_HOOD_COOLDOWN`).
   */
  async updateHomeHood(hood: HomeHoodInput): Promise<AuthResponse> {
    const current = this.user();
    if (!current) return { ok: false, code: 'no-user', message: 'Not signed in.' };
    try {
      await firstValueFrom(
        this.supabase.upsertRow('users', {
          uid: current.uid,
          home_state: hood.state,
          home_country: hood.country,
          home_district: hood.district,
          home_place: hood.place ?? null,
          home_lat: hood.lat ?? null,
          home_lng: hood.lng ?? null,
        }),
      );
      const nextHood = new Hood({
        name: hood.place || hood.district || hood.state,
        state: hood.state,
        country: hood.country,
        district: hood.district,
        place: hood.place || '',
        coords: { lat: hood.lat ?? 0, lng: hood.lng ?? 0 },
        updatedAt: new Date().toISOString(),
      });
      this.user.set({ ...current, hood: nextHood });
      this.store.dispatch(setUserPreference({ pref: { hood: nextHood } }));
      return { ok: true, uid: current.uid, email: current.email ?? null, username: current.name };
    } catch (err: unknown) {
      return { ok: false, ...toAppError(err, 'update-home-hood') };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.signInWithPassword(email, password),
      );
      if (error) {
        return {
          ok: false,
          ...toAppError(error, 'login'),
        };
      }
      const u = data.user!;
      return {
        ok: true,
        uid: u.id,
        email: u.email ?? null,
        username:
          (u.user_metadata?.['username'] as string | undefined) ?? u.email?.split('@')[0] ?? 'User',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        ...toAppError(err, 'login'),
      };
    }
  }

  async signup(
    email: string,
    password: string,
    metadata: {
      username: string;
      fullName: string;
      birthday: string;
      hood: HomeHoodInput;
    },
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.signUp(email, password, {
          username: metadata.username,
          full_name: metadata.fullName,
          birthday: metadata.birthday,
          home_hood: {
            state: metadata.hood.state,
            country: metadata.hood.country,
            district: metadata.hood.district,
            place: metadata.hood.place ?? '',
            lat: metadata.hood.lat ?? null,
            lng: metadata.hood.lng ?? null,
          },
        }),
      );
      if (error) {
        return {
          ok: false,
          ...toAppError(error, 'signup'),
        };
      }
      const u = data.user!;
      return {
        ok: true,
        uid: u.id,
        email: u.email ?? null,
        username: metadata.username,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        ...toAppError(err, 'signup'),
      };
    }
  }

  isUsernameTaken(username: string): Promise<boolean> {
    return firstValueFrom(this.supabase.isUsernameTaken(username));
  }

  logout() {
    this.user.set(null);
    return firstValueFrom(this.supabase.signOut());
  }

  async loginGuest() {
    const { data, error } = await firstValueFrom(this.supabase.signInAnonymously());
    if (error) throw error;

    const uid = data.user!.id;
    await firstValueFrom(
      this.supabase.upsertRow('users', {
        uid,
        name: uid.slice(0, 8),
        is_guest: true,
        created_at: new Date().toISOString(),
      }),
    );
  }

  async convertGuestToPermanent(
    email: string,
    password: string,
    username: string,
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.updateUser({ email, password, data: { username } }),
      );
      if (error) {
        return {
          ok: false,
          ...toAppError(error, 'convert-guest'),
        };
      }
      const uid = data.user!.id;
      await firstValueFrom(
        this.supabase.upsertRow('users', {
          uid,
          name: username,
          is_guest: false,
          email,
          created_at: new Date().toISOString(),
        }),
      );
      this.user.set({ uid, name: username, isGuest: false, email });
      return {
        ok: true,
        uid,
        email,
        username,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        ...toAppError(err, 'convert-guest'),
      };
    }
  }

  resetPassword(email: string) {
    return firstValueFrom(this.supabase.resetPassword(email));
  }

  updatePassword(password: string) {
    return firstValueFrom(this.supabase.updatePassword(password));
  }
}
