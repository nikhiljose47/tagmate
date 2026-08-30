import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    FB?: {
      init(params: Record<string, unknown>): void;
      login(
        callback: (response: { authResponse?: { code?: string } }) => void,
        params: Record<string, unknown>,
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Lazily loads Meta's JS SDK (only needed for the WhatsApp "Connect" button's
 * Embedded Signup popup — see profile.ts) and wraps `FB.login()` as a
 * promise. No other part of the app talks to Meta from the browser; every
 * Graph API call happens server-side in functions/api/integrations/whatsapp/*.
 *
 * IMPORTANT: the exact `FB.login()` params for WhatsApp Embedded Signup
 * (config_id, response_type, extras.sessionInfoVersion, ...) reflect Meta's
 * documented flow at the time this was written — re-verify against
 * developers.facebook.com/docs/whatsapp/embedded-signup before production.
 */
@Injectable({ providedIn: 'root' })
export class FacebookSdkService {
  private loadPromise: Promise<void> | null = null;

  private load(): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Browser only.'));
    if (window.FB) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        window.FB!.init({
          appId: environment.metaAppId,
          autoLogAppEvents: false,
          xfbml: false,
          version: environment.metaGraphApiVersion,
        });
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Could not load Meta SDK.'));
      document.body.appendChild(script);
    });
    return this.loadPromise;
  }

  /** Opens the WhatsApp Embedded Signup popup; resolves with the
   *  authorization `code` on success, or `null` if the business closed the
   *  popup without completing signup. */
  async launchWhatsAppEmbeddedSignup(): Promise<string | null> {
    await this.load();
    return new Promise<string | null>((resolve) => {
      window.FB!.login(
        (response) => {
          const code = response.authResponse?.code;
          resolve(code ?? null);
        },
        {
          config_id: environment.whatsappEmbeddedSignupConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { sessionInfoVersion: '3' },
        },
      );
    });
  }
}
