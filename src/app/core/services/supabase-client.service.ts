import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
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
    }
  );
}
