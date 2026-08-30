export interface AppEnvironment {
  environmentName: 'development' | 'staging' | 'production';
  production: boolean;
  mapTilerApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Meta App ID — not secret; Meta's own JS SDK requires it client-side for
   *  the WhatsApp Embedded Signup popup (functions/api/integrations/whatsapp/*
   *  hold the actual secret server-side). */
  metaAppId: string;
  metaGraphApiVersion: string;
  /** Embedded Signup configuration id from Meta Business Manager — also not
   *  secret, required by `FB.login()`. */
  whatsappEmbeddedSignupConfigId: string;
}
