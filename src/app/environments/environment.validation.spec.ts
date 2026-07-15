import { AppEnvironment } from './environment.model';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validEnvironment: AppEnvironment = {
    production: false,
    mapTilerApiKey: 'map-key',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
  };

  it('accepts complete HTTPS configuration', () => {
    expect(() => validateEnvironment(validEnvironment)).not.toThrow();
  });

  it('identifies missing settings and invalid Supabase URLs', () => {
    expect(() => validateEnvironment({ ...validEnvironment, mapTilerApiKey: '' })).toThrowError(
      'Missing required application configuration: mapTilerApiKey',
    );
    expect(() => validateEnvironment({ ...validEnvironment, supabaseUrl: 'http://example.test' })).toThrowError(
      'Invalid required application configuration: supabaseUrl must be an HTTPS URL.',
    );
  });
});
