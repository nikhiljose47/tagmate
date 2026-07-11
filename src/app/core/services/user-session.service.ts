import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom, Observable, of, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { AppUser } from '../models/app-user.model';
import { UserModel } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private supabase = inject(SupabaseService);

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
          }
    )
  );

  constructor() {
    this.supabase.session$
      .pipe(
        switchMap((session) => {
          if (!session?.user) {
            return of(null);
          }

          const uid = session.user.id;
          return this.supabase.getUserById(uid).pipe(
            switchMap((appUser) => {
              if (appUser) {
                // Email is sourced from the authenticated session, never from
                // the public profile row returned for arbitrary users.
                return of({ ...appUser, email: session.user.email ?? undefined });
              }

              const name =
                (session.user.user_metadata?.['username'] as string | undefined) ??
                session.user.email?.split('@')[0] ??
                'User';
              const isGuest = session.user.is_anonymous ?? false;
              const newAppUser: AppUser = {
                uid,
                name,
                isGuest,
                email: session.user.email ?? undefined,
              };

              return from(
                this.supabase.upsertRow('users', {
                  uid,
                  name,
                  is_guest: isGuest,
                  email: session.user.email ?? null,
                  created_at: new Date().toISOString(),
                })
              ).pipe(map(() => newAppUser));
            })
          );
        })
      )
      .subscribe((appUser) => {
        this.user.set(appUser);
      });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.signInWithPassword(email, password)
      );
      if (error) {
        return {
          ok: false,
          code: String((error as any).status ?? 'auth/unknown'),
          message: (error as any).message ?? 'Something went wrong',
        };
      }
      const u = data.user!;
      return {
        ok: true,
        uid: u.id,
        email: u.email ?? null,
        username:
          (u.user_metadata?.['username'] as string | undefined) ??
          u.email?.split('@')[0] ??
          'User',
      };
    } catch (err: any) {
      return {
        ok: false,
        code: 'auth/unknown',
        message: err?.message ?? 'Something went wrong',
      };
    }
  }

  async signup(
    email: string,
    password: string,
    metadata: { username: string; fullName: string; birthday: string }
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.signUp(email, password, {
          username: metadata.username,
          full_name: metadata.fullName,
          birthday: metadata.birthday,
        })
      );
      if (error) {
        return {
          ok: false,
          code: String((error as any).status ?? 'auth/unknown'),
          message: (error as any).message ?? 'Something went wrong',
        };
      }
      const u = data.user!;
      return {
        ok: true,
        uid: u.id,
        email: u.email ?? null,
        username: metadata.username,
      };
    } catch (err: any) {
      return {
        ok: false,
        code: 'auth/unknown',
        message: err?.message ?? 'Something went wrong',
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
      })
    );
  }

  async convertGuestToPermanent(
    email: string,
    password: string,
    username: string
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await firstValueFrom(
        this.supabase.updateUser({ email, password, data: { username } })
      );
      if (error) {
        return {
          ok: false,
          code: String((error as any).status ?? 'auth/unknown'),
          message: (error as any).message ?? 'Something went wrong',
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
        })
      );
      this.user.set({ uid, name: username, isGuest: false, email });
      return {
        ok: true,
        uid,
        email,
        username,
      };
    } catch (err: any) {
      return {
        ok: false,
        code: 'auth/unknown',
        message: err?.message ?? 'Something went wrong',
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
