import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom, Observable, of, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AccountType, AppUser } from '../models/app-user.model';
import { Hood } from '../models/hood.model';
import { UserModel } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
import { SupabaseService } from './supabase.service';
import { toAppError } from '../models/app-error.model';
import { setUserPreference } from '../../store/user-preferences/user-preference.actions';
import { isEmailAddress, isValidUsername, normalizeUsername } from '../utils/auth-identifier.utils';

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
          const metaAccountType =
            session.user.user_metadata?.['account_type'] === 'business' ? 'business' : 'personal';
          const metaBusinessName = session.user.user_metadata?.['business_name'] as
            | string
            | undefined;
          const metaBusinessPhone = session.user.user_metadata?.['business_phone'] as
            | string
            | undefined;
          const metaBusinessWebsite = session.user.user_metadata?.['business_website'] as
            | string
            | undefined;
          const metaBusinessCategory = session.user.user_metadata?.['business_category'] as
            | string
            | undefined;
          const metaBusinessEstablishedYear = session.user.user_metadata?.[
            'business_established_year'
          ] as number | undefined;
          const fallbackUser: AppUser = {
            uid,
            name,
            isGuest,
            email: session.user.email ?? undefined,
            accountType: metaAccountType,
            businessName: metaBusinessName,
            businessPhone: metaBusinessPhone,
            businessWebsite: metaBusinessWebsite,
            businessCategory: metaBusinessCategory,
            businessEstablishedYear: metaBusinessEstablishedYear,
          };

          const metaHood = session.user.user_metadata?.['home_hood'] as HomeHoodInput | undefined;

          return this.supabase.getCurrentUserById(uid).pipe(
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
                  account_type: metaAccountType,
                  business_name: metaBusinessName ?? null,
                  business_phone: metaBusinessPhone ?? null,
                  business_website: metaBusinessWebsite ?? null,
                  business_category: metaBusinessCategory ?? null,
                  business_established_year: metaBusinessEstablishedYear ?? null,
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

  async login(emailOrUsername: string, password: string): Promise<AuthResponse> {
    try {
      const identifier = emailOrUsername.trim();
      const { data, error } = await firstValueFrom(
        isEmailAddress(identifier)
          ? this.supabase.signInWithPassword(identifier, password)
          : this.supabase.signInWithUsername(identifier, password),
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
      accountType?: AccountType;
      businessName?: string;
      businessPhone?: string;
      businessWebsite?: string;
      businessCategory?: string;
      businessEstablishedYear?: number;
    },
  ): Promise<AuthResponse> {
    try {
      const username = normalizeUsername(metadata.username);
      if (!isValidUsername(username)) {
        return {
          ok: false,
          code: 'invalid_username',
          message: 'Username must be 3–40 characters and cannot contain @.',
        };
      }

      const availability = await this.checkSignupAvailability(email, username);
      if (availability.emailTaken) {
        return {
          ok: false,
          code: 'email_taken',
          message: 'Entered email address is already in use',
        };
      }

      if (availability.usernameTaken) {
        return {
          ok: false,
          code: 'username_taken',
          message: 'username already in use',
        };
      }

      const { data, error } = await firstValueFrom(
        this.supabase.signUp(email, password, {
          username,
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
          account_type: metadata.accountType ?? 'personal',
          business_name: metadata.accountType === 'business' ? (metadata.businessName ?? '') : '',
          business_phone: metadata.accountType === 'business' ? (metadata.businessPhone ?? '') : '',
          business_website:
            metadata.accountType === 'business' ? (metadata.businessWebsite ?? '') : '',
          business_category:
            metadata.accountType === 'business' ? (metadata.businessCategory ?? '') : '',
          business_established_year:
            metadata.accountType === 'business' ? (metadata.businessEstablishedYear ?? null) : null,
          email_opt_out_token: this.createEmailOptOutToken(),
        }),
      );
      if (error) {
        // A competing signup can win after the initial availability check.
        // Re-check once so Auth's intentionally generic trigger error becomes
        // the same actionable message as the normal validation path.
        const conflict = await this.checkSignupAvailability(email, username).catch(() => null);
        if (conflict?.usernameTaken || this.isUsernameUniqueViolation(error)) {
          return { ok: false, code: 'username_taken', message: 'Username is already in use.' };
        }
        if (conflict?.emailTaken) {
          return {
            ok: false,
            code: 'email_taken',
            message: 'Entered email address is already in use',
          };
        }
        return {
          ok: false,
          ...toAppError(error, 'signup'),
        };
      }
      const u = data.user!;
      // Supabase deliberately obscures duplicate-signup attempts when email
      // confirmation is enabled. The empty identities array is the documented
      // duplicate response shape, so turn it into the same useful validation
      // result as the availability check above.
      if (u.identities?.length === 0) {
        return {
          ok: false,
          code: 'email_taken',
          message: 'Entered email address is already in use',
        };
      }
      return {
        ok: true,
        uid: u.id,
        email: u.email ?? null,
        username,
        needsEmailConfirmation: !data.session,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        ...toAppError(err, 'signup'),
      };
    }
  }

  isUsernameTaken(username: string): Promise<boolean> {
    return firstValueFrom(this.supabase.isUsernameTaken(normalizeUsername(username)));
  }

  isEmailTaken(email: string): Promise<boolean> {
    return firstValueFrom(this.supabase.isEmailTaken(email));
  }

  async checkSignupAvailability(email: string, username: string) {
    return firstValueFrom(
      this.supabase.checkSignupAvailability(email, normalizeUsername(username)),
    );
  }

  /** Generates a unique `multi-tenant-web.nikhiljose47.workers.dev/<code>/<business-name-slug>` link — throws if generation fails. */
  async generateBusinessWebsite(businessName: string): Promise<string> {
    const { website } = await this.supabase.generateBusinessWebsite(businessName);
    return website;
  }

  async resendConfirmationEmail(emailOrUsername: string): Promise<boolean> {
    try {
      const value = emailOrUsername.trim();
      if (isEmailAddress(value)) {
        const { error } = await firstValueFrom(this.supabase.resendSignupConfirmation(value));
        return !error;
      }
      const { error } = await firstValueFrom(
        this.supabase.resendSignupConfirmationForUsername(value),
      );
      return !error;
    } catch {
      return false;
    }
  }

  logout() {
    this.user.set(null);
    return firstValueFrom(this.supabase.signOut());
  }

  async deleteAccount(): Promise<void> {
    await this.supabase.deleteAccount();
    this.user.set(null);
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
      this.user.set({ uid, name: username, isGuest: false, email, accountType: 'personal' });
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

  /**
   * Business-account contact info — separate from `updateOwnProfile` (name/bio)
   * since those go through a fixed RPC. Writes straight to `public.users`.
   */
  async updateBusinessProfile(fields: {
    businessName: string;
    businessPhone: string;
    businessWebsite: string;
    businessCategory?: string;
    businessImages?: string[];
    avatarUrl?: string;
  }): Promise<boolean> {
    const current = this.user();
    if (!current) return false;
    try {
      await firstValueFrom(
        this.supabase.upsertRow('users', {
          uid: current.uid,
          business_name: fields.businessName.trim() || null,
          business_phone: fields.businessPhone.trim() || null,
          business_website: fields.businessWebsite.trim() || null,
          ...(fields.businessCategory !== undefined
            ? { business_category: fields.businessCategory.trim() || null }
            : {}),
          ...(fields.businessImages !== undefined
            ? { business_images: fields.businessImages }
            : {}),
          ...(fields.avatarUrl !== undefined ? { avatar_url: fields.avatarUrl || null } : {}),
        }),
      );
      this.user.set({
        ...current,
        businessName: fields.businessName.trim() || undefined,
        businessPhone: fields.businessPhone.trim() || undefined,
        businessWebsite: fields.businessWebsite.trim() || undefined,
        ...(fields.businessCategory !== undefined
          ? { businessCategory: fields.businessCategory.trim() || undefined }
          : {}),
        ...(fields.businessImages !== undefined ? { businessImages: fields.businessImages } : {}),
        ...(fields.avatarUrl !== undefined ? { avatarUrl: fields.avatarUrl || undefined } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sets the uploaded shop/business image URLs straight after signup (no other
   * fields touched). Takes an explicit `uid` — right after signup() resolves,
   * the reactive `user()` signal usually hasn't been populated yet (it's filled
   * asynchronously via a separate subscription), so reading `this.user()?.uid`
   * here would silently no-op instead of persisting the upload.
   */
  async updateBusinessImages(images: string[], uid?: string): Promise<boolean> {
    const current = this.user();
    const targetUid = uid ?? current?.uid;
    if (!targetUid) return false;
    try {
      await firstValueFrom(
        this.supabase.upsertRow('users', { uid: targetUid, business_images: images }),
      );
      if (current?.uid === targetUid) this.user.set({ ...current, businessImages: images });
      return true;
    } catch {
      return false;
    }
  }

  /** Sets the uploaded business logo URL straight after signup (no other fields touched). Same `uid` note as {@link updateBusinessImages}. */
  async updateAvatarUrl(url: string, uid?: string): Promise<boolean> {
    const current = this.user();
    const targetUid = uid ?? current?.uid;
    if (!targetUid) return false;
    try {
      await firstValueFrom(this.supabase.upsertRow('users', { uid: targetUid, avatar_url: url }));
      if (current?.uid === targetUid) this.user.set({ ...current, avatarUrl: url });
      return true;
    } catch {
      return false;
    }
  }

  private createEmailOptOutToken(): string {
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      throw new Error('This browser cannot securely create an email preference token.');
    }
    return crypto.randomUUID();
  }

  private isUsernameUniqueViolation(error: unknown): boolean {
    const source = error as { code?: unknown; message?: unknown };
    return (
      String(source?.code ?? '') === '23505' &&
      /users_name_ci_unique|users.*name/i.test(String(source?.message ?? ''))
    );
  }
}
