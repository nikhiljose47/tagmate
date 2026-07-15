import { AppEnvironment } from './environment.model';

/** Fails early with an actionable message instead of a broken map or auth flow. */
export function validateEnvironment(environment: AppEnvironment): void {
  const missing = [
    !environment.mapTilerApiKey?.trim() && 'mapTilerApiKey',
    !environment.supabaseUrl?.trim() && 'supabaseUrl',
    !environment.supabaseAnonKey?.trim() && 'supabaseAnonKey',
  ].filter((value): value is string => Boolean(value));

  if (missing.length) {
    throw new Error(`Missing required application configuration: ${missing.join(', ')}`);
  }

  try {
    const url = new URL(environment.supabaseUrl);
    if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  } catch {
    throw new Error('Invalid required application configuration: supabaseUrl must be an HTTPS URL.');
  }
}
