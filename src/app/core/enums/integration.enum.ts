/**
 * Third-party integrations a business can connect (OAuth-authorized API
 * access — distinct from the plain public `social*` URL fields on `AppUser`,
 * see [[BusinessIntegration]]). New providers (Facebook, LinkedIn, Google
 * Business, ...) slot in here without any other model changes.
 */
export enum IntegrationProvider {
  Instagram = 'instagram',
  Whatsapp = 'whatsapp',
}

/**
 * `Connected` is only ever set server-side once real OAuth exists (Step 2/3)
 * — a business can self-service down to `Disconnected` but never back up.
 */
export enum IntegrationStatus {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
  Expired = 'expired',
}

/** Where a post can be published. `Website` represents our own app/feed. */
export enum PublicationDestination {
  Website = 'website',
  Instagram = 'instagram',
}

export enum PublicationStatus {
  Pending = 'pending',
  Publishing = 'publishing',
  Published = 'published',
  Failed = 'failed',
}
