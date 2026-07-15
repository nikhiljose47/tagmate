import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly platformId = inject(PLATFORM_ID);
  private static testClientSequence = 0;
  private readonly authStorageKey = this.createStorageKey();

  private createStorageKey(): string | undefined {
    // TestBed deliberately creates multiple root injectors. Isolating their
    // auth storage prevents Supabase clients from sharing mutable test state.
    if (typeof globalThis !== 'undefined' && '__karma__' in globalThis) {
      return `tagmate-test-auth-${++SupabaseClientService.testClientSequence}`;
    }
    return undefined;
  }

  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        ...(this.authStorageKey ? { storageKey: this.authStorageKey } : {}),
        storage: isPlatformBrowser(this.platformId)
          ? globalThis.localStorage
          : {
              getItem: (_key: string) => null,
              setItem: (_key: string, _value: string) => {},
              removeItem: (_key: string) => {},
            },
        autoRefreshToken: isPlatformBrowser(this.platformId),
        persistSession: isPlatformBrowser(this.platformId),
        detectSessionInUrl: isPlatformBrowser(this.platformId),
      },
    },
  );
}
