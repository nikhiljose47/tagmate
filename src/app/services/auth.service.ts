import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { UserModel } from '../models/user.model';
import { AuthResponse } from '../models/auth-response.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);

  private _user = new BehaviorSubject<UserModel>({
    uid: 'guest',
    email: null,
    username: 'Guest',
    isGuest: true,
  });
  user$ = this._user.asObservable();

  constructor() {
    this.supabase.session$.subscribe((session) => {
      if (session?.user) {
        const u = session.user;
        this._user.next({
          uid: u.id,
          email: u.email ?? null,
          username:
            (u.user_metadata?.['username'] as string | undefined) ??
            u.email?.split('@')[0] ??
            'User',
          isGuest: u.is_anonymous ?? false,
        });
      } else {
        this._user.next({ uid: 'guest', email: null, username: 'Guest', isGuest: true });
      }
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

  async logout(): Promise<void> {
    await firstValueFrom(this.supabase.signOut());
  }
}
