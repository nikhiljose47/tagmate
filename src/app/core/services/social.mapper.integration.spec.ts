import {
  BusinessIntegrationRow,
  PostPublicationRow,
  rowToBusinessIntegration,
  rowToPostPublication,
} from './social.mapper';
import { IntegrationProvider, IntegrationStatus } from '../enums/integration.enum';

describe('rowToBusinessIntegration', () => {
  const baseRow: BusinessIntegrationRow = {
    id: 'int-1',
    user_id: 'user-a',
    provider: 'instagram',
    status: 'connected',
    provider_account_id: 'ig-123',
    provider_account_name: '@examplebusiness',
    token_expires_at: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('maps every safe column to its camelCase counterpart', () => {
    expect(rowToBusinessIntegration(baseRow)).toEqual({
      id: 'int-1',
      userId: 'user-a',
      provider: IntegrationProvider.Instagram,
      status: IntegrationStatus.Connected,
      providerAccountId: 'ig-123',
      providerAccountName: '@examplebusiness',
      tokenExpiresAt: null,
      metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('never carries a credential — even if one leaked onto the row object', () => {
    // The `my_business_integrations` view this row type describes structurally
    // cannot select token columns, but this test guards the mapper itself in
    // case that ever changes: it must never start copying an access/refresh
    // token onto the object handed back to the frontend.
    const leaked = {
      ...baseRow,
      access_token_encrypted: 'iv.ciphertext',
    } as BusinessIntegrationRow;
    const mapped = rowToBusinessIntegration(leaked) as unknown as Record<string, unknown>;
    expect(mapped['accessToken']).toBeUndefined();
    expect(mapped['accessTokenEncrypted']).toBeUndefined();
    expect(Object.keys(mapped)).not.toContain('access_token_encrypted');
  });
});

describe('rowToPostPublication', () => {
  it('maps every column to its camelCase counterpart', () => {
    const row: PostPublicationRow = {
      id: 'pub-1',
      post_id: 'post-1',
      provider: 'instagram',
      status: 'failed',
      provider_post_id: null,
      error_code: 'RATE_LIMITED',
      error_message: 'Try again later.',
      published_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:05:00.000Z',
    };

    const mapped = rowToPostPublication(row);
    expect(mapped.postId).toBe('post-1');
    expect(mapped.errorCode).toBe('RATE_LIMITED');
    expect(mapped.status).toBe('failed');
  });
});
