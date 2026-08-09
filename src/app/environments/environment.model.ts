export interface AppEnvironment {
  environmentName: 'development' | 'staging' | 'production';
  production: boolean;
  mapTilerApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}
