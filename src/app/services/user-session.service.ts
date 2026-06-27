import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../models/app-user.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private supabase = inject(SupabaseService);

  user = signal<AppUser | null>(null);

  constructor() {
    this.supabase.session$.subscribe(async (session) => {
      if (!session?.user) {
        this.user.set(null);
        return;
      }

      const uid = session.user.id;
      const appUser = await firstValueFrom(this.supabase.getUserById(uid));

      if (appUser) {
        this.user.set(appUser);
      } else {
        this.user.set({
          uid,
          name:
            (session.user.user_metadata?.['username'] as string | undefined) ??
            session.user.email?.split('@')[0] ??
            'User',
          isGuest: session.user.is_anonymous ?? false,
          email: session.user.email,
        });
      }
    });
  }

  login(email: string, password: string) {
    return firstValueFrom(this.supabase.signInWithPassword(email, password));
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
        name: 'Guest User',
        is_guest: true,
        created_at: new Date().toISOString(),
      })
    );
  }
}
