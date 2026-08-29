import { IntegrationProvider, IntegrationStatus } from '../enums/integration.enum';

/**
 * Safe, frontend-facing shape of a business's third-party connection —
 * this is the ONLY shape the client ever sees. It deliberately has no
 * token/credential fields; those exist solely on `business_integrations`
 * table columns that are never selectable by the `authenticated` role (see
 * the `my_business_integrations` view in the business-integrations migration
 * and `BusinessIntegrationRow` in `social.mapper.ts`, which mirrors this
 * same safe column set).
 */
export interface BusinessIntegration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  providerAccountId: string | null;
  providerAccountName: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Convenience view used by the Connections UI — one entry per known provider,
 *  synthesizing "not connected yet" for providers with no row at all. */
export interface ConnectionSummary {
  provider: IntegrationProvider;
  connected: boolean;
  status: IntegrationStatus;
  accountName: string | null;
}
