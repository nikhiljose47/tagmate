export enum ConversationStatus {
  Open = 'open',
  Archived = 'archived',
}

export enum MessageDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

export enum MessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Document = 'document',
  Audio = 'audio',
  Template = 'template',
  Unknown = 'unknown',
}

export enum MessageStatus {
  Received = 'received',
  Queued = 'queued',
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Failed = 'failed',
}
