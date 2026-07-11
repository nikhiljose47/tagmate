import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Observable, ReplaySubject, from, map } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly clientService = inject(SupabaseClientService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly client = this.clientService.client;

  // Do not emit a placeholder `null`: guards must wait until Supabase has
  // actually restored (or rejected) the persisted browser session.
  private readonly _session$ = new ReplaySubject<Session | null>(1);
  readonly session$: Observable<Session | null> = this._session$.asObservable();
  private readonly authSubscription: { unsubscribe(): void };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.client.auth.getSession()
        .then(({ data, error }) => {
          if (error) throw error;
          this._session$.next(data.session);
        })
        .catch(() => this._session$.next(null));
    } else {
      this._session$.next(null);
    }

    this.authSubscription = this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this._session$.next(session);
      }
    ).data.subscription;
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this._session$.complete();
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
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return !!data && data.length > 0;
    }));
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

  updateUser(attributes: { email?: string; password?: string; data?: Record<string, unknown> }) {
    return from(this.client.auth.updateUser(attributes));
  }

  updateUserMetadata(metadata: Record<string, unknown>) {
    return from(this.client.auth.updateUser({ data: metadata }));
  }
}
