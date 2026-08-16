import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Observable, ReplaySubject, from, map } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';
import { clearUserStorage } from '../utils/local-storage.util';

export interface SignupAvailability {
  emailTaken: boolean;
  usernameTaken: boolean;
}

type EdgeAuthError = Error & { code?: string };

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
      void this.client.auth
        .getSession()
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
      },
    ).data.subscription;
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this._session$.complete();
  }

  signInWithPassword(email: string, password: string) {
    return from(this.client.auth.signInWithPassword({ email, password }));
  }

  /**
   * Resolves a username and exchanges the password on the server, so an email
   * address is never returned to the browser merely to support username login.
   */
  signInWithUsername(username: string, password: string) {
    return from(this.signInWithUsernameRequest(username, password));
  }

  signUp(email: string, password: string, metadata: Record<string, unknown>) {
    return from(this.client.auth.signUp({ email, password, options: { data: metadata } }));
  }

  resendSignupConfirmation(email: string) {
    return from(this.client.auth.resend({ type: 'signup', email }));
  }

  resendSignupConfirmationForUsername(username: string) {
    return from(
      this.requestAuthEndpoint<{ ok: boolean }>('/api/auth/resend-confirmation', { username }).then(
        () => ({ data: { user: null, session: null }, error: null }),
      ),
    );
  }

  isUsernameTaken(username: string): Observable<boolean> {
    return this.checkSignupAvailability(undefined, username).pipe(
      map((result) => result.usernameTaken),
    );
  }

  isEmailTaken(email: string): Observable<boolean> {
    return this.checkSignupAvailability(email, undefined).pipe(map((result) => result.emailTaken));
  }

  /** Generates a unique `mshop.in/<code>/<slug>` link for a business name — see functions/api/business/generate-website.js. */
  generateBusinessWebsite(businessName: string): Promise<{ website: string }> {
    return this.requestAuthEndpoint<{ website: string }>('/api/business/generate-website', {
      businessName,
    });
  }

  checkSignupAvailability(email?: string, username?: string): Observable<SignupAvailability> {
    return from(
      this.requestAuthEndpoint<SignupAvailability>('/api/auth/availability', {
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(username?.trim() ? { username: username.trim() } : {}),
      }),
    );
  }

  signInAnonymously() {
    return from(this.client.auth.signInAnonymously());
  }

  signOut() {
    return from(this.signOutAndClearUserStorage());
  }

  /**
   * Permanently deletes the signed-in user's account (profile, posts,
   * messages, etc. server-side, then the auth login itself) and clears the
   * local session. Throws if the request fails — callers should show the
   * error and leave the (still-active) account untouched.
   */
  async deleteAccount(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    const session = data.session;
    if (!session) {
      throw new Error('You must be signed in to delete your account.');
    }

    const response = await fetch('/api/auth/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || 'Could not delete your account.');
    }

    await this.client.auth.signOut();
    clearUserStorage(session.user.id);
  }

  private async signOutAndClearUserStorage() {
    const { data: userData } = await this.client.auth.getUser();
    const result = await this.client.auth.signOut();
    if (!result.error && userData.user?.id) clearUserStorage(userData.user.id);
    return result;
  }

  resetPassword(email: string) {
    const redirectUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/login/update-password` : '';
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

  private async signInWithUsernameRequest(username: string, password: string) {
    const credentials = await this.requestAuthEndpoint<{
      access_token: string;
      refresh_token: string;
    }>('/api/auth/login', { username: username.trim(), password });
    return this.client.auth.setSession({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });
  }

  private async requestAuthEndpoint<T>(path: string, body: Record<string, string>): Promise<T> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    if (!response.ok) {
      const error: EdgeAuthError = new Error(
        payload.error || 'Authentication service unavailable.',
      );
      error.code = payload.code;
      throw error;
    }
    return payload as T;
  }
}
