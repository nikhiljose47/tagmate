import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, map } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly client = this.clientService.client;

  private readonly _session$ = new BehaviorSubject<Session | null>(null);
  readonly session$: Observable<Session | null> = this._session$.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.client.auth.getSession().then(({ data }) => this._session$.next(data.session));
    }

    this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this._session$.next(session);
      }
    );
  }

  signInWithPassword(email: string, password: string) {
    return from(this.client.auth.signInWithPassword({ email, password }));
  }

  signUp(email: string, password: string, metadata: Record<string, unknown>) {
    return from(this.client.auth.signUp({ email, password, options: { data: metadata } }));
  }

  isUsernameTaken(username: string): Observable<boolean> {
    return from(
      this.client.from('users').select('uid').ilike('name', username).limit(1)
    ).pipe(map(({ data }) => !!data && data.length > 0));
  }

  signInAnonymously() {
    return from(this.client.auth.signInAnonymously());
  }

  signOut() {
    return from(this.client.auth.signOut());
  }

  resetPassword(email: string) {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login/update-password` : '';
    return from(this.client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl }));
  }

  updatePassword(password: string) {
    return from(this.client.auth.updateUser({ password }));
  }

  updateUserMetadata(metadata: Record<string, unknown>) {
    return from(this.client.auth.updateUser({ data: metadata }));
  }
}
