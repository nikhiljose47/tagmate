import {
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '../enums/whatsapp.enum';

/** Typed shape of `BusinessIntegration.metadata` for `provider = 'whatsapp'`
 *  — see business-integration.model.ts. Keeps WABA/phone identifiers out of
 *  `businessPhone`/`socialWhatsapp`, which remain the plain-URL/contact-number
 *  concepts established in Step 1. */
export interface WhatsAppIntegrationMetadata {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  /** Set when the WABA connected successfully but webhook subscription
   *  failed — the integration exists but isn't fully operational yet. */
  setupIncomplete?: boolean;
}

export interface WhatsAppConversation {
  id: string;
  businessId: string;
  integrationId: string;
  customerWaId: string;
  customerPhone: string | null;
  customerName: string | null;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  businessId: string;
  conversationId: string;
  integrationId: string;
  providerMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  textBody: string | null;
  providerMediaId: string | null;
  mediaUrl: string | null;
  status: MessageStatus;
  errorCode: string | null;
  errorMessage: string | null;
  providerTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}
