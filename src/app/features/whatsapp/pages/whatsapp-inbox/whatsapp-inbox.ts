import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { WhatsAppService, WhatsAppTemplate } from '../../../../core/services/whatsapp.service';
import { BusinessIntegrationService } from '../../../../core/services/business-integration.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { WhatsAppConversation, WhatsAppMessage } from '../../../../core/models/whatsapp.model';
import { IntegrationProvider, IntegrationStatus } from '../../../../core/enums/integration.enum';

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-whatsapp-inbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './whatsapp-inbox.html',
  styleUrl: './whatsapp-inbox.scss',
})
export class WhatsAppInboxPage implements OnInit {
  private readonly whatsapp = inject(WhatsAppService);
  private readonly integrationsApi = inject(BusinessIntegrationService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly connectionState = signal<'loading' | 'disconnected' | 'error' | 'connected'>('loading');
  readonly conversations = signal<WhatsAppConversation[]>([]);
  readonly selectedConversation = signal<WhatsAppConversation | null>(null);
  readonly messages = signal<WhatsAppMessage[]>([]);
  readonly replyText = signal('');
  readonly loadingConversations = signal(true);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  private readonly retryingMessageIds = signal<ReadonlySet<string>>(new Set());
  readonly templates = signal<WhatsAppTemplate[]>([]);
  readonly showTemplatePicker = signal(false);
  readonly selectedTemplateName = signal('');
  readonly templateParameters = signal<string[]>([]);

  readonly selectedTemplate = computed(
    () => this.templates().find((t) => t.name === this.selectedTemplateName()) ?? null,
  );

  /** Live preview with entered values substituted into `{{1}}`-style
   *  placeholders — unfilled ones still show as `{{n}}` so it's obvious
   *  what's missing. */
  readonly templatePreview = computed(() => {
    const template = this.selectedTemplate();
    if (!template) return '';
    const values = this.templateParameters();
    return template.bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n: string) => {
      const value = values[Number(n) - 1];
      return value?.trim() ? value : match;
    });
  });

  readonly templateReadyToSend = computed(() => {
    const template = this.selectedTemplate();
    if (!template) return false;
    const values = this.templateParameters();
    return values.length === template.variableCount && values.every((v) => v.trim().length > 0);
  });

  readonly outsideServiceWindow = computed(() => {
    const conv = this.selectedConversation();
    if (!conv?.lastCustomerMessageAt) return true;
    return Date.now() - new Date(conv.lastCustomerMessageAt).getTime() >= SERVICE_WINDOW_MS;
  });

  ngOnInit(): void {
    this.integrationsApi
      .getIntegration(IntegrationProvider.Whatsapp)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((integration) => {
        if (integration?.status === IntegrationStatus.Connected) {
          this.connectionState.set('connected');
          this.loadConversations();
        } else if (integration) {
          this.connectionState.set('error');
        } else {
          this.connectionState.set('disconnected');
        }
      });
  }

  private loadConversations(): void {
    this.loadingConversations.set(true);
    this.whatsapp
      .getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.conversations.set(
            [...rows].sort(
              (a, b) =>
                new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
            ),
          );
          this.loadingConversations.set(false);
        },
        error: (err: unknown) => {
          this.logger.error('Failed to load WhatsApp conversations', err);
          this.loadingConversations.set(false);
        },
      });
  }

  async selectConversation(conversation: WhatsAppConversation): Promise<void> {
    this.selectedConversation.set(conversation);
    this.showTemplatePicker.set(false);
    this.loadingMessages.set(true);
    try {
      this.messages.set(await this.whatsapp.getMessages(conversation.id));
      void this.whatsapp.markRead(conversation.id);
    } catch (err: unknown) {
      this.logger.error('Failed to load WhatsApp messages', err);
      this.toast.show('Could not load this conversation.', 'danger');
    } finally {
      this.loadingMessages.set(false);
    }
  }

  async send(): Promise<void> {
    const conversation = this.selectedConversation();
    const text = this.replyText().trim();
    if (!conversation || !text || this.sending()) return;
    this.sending.set(true);
    try {
      const message = await this.whatsapp.sendMessage(conversation.id, text);
      this.messages.update((msgs) => [...msgs, message]);
      this.replyText.set('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not send this message.';
      if (message.includes('24 hours')) {
        this.showTemplatePicker.set(true);
        void this.loadTemplates();
      }
      this.toast.show(message, 'danger');
    } finally {
      this.sending.set(false);
    }
  }

  isRetrying(messageId: string): boolean {
    return this.retryingMessageIds().has(messageId);
  }

  async retry(message: WhatsAppMessage): Promise<void> {
    if (this.isRetrying(message.id)) return;
    this.retryingMessageIds.update((ids) => new Set(ids).add(message.id));
    try {
      await this.whatsapp.retryMessage(message.id);
      const conversation = this.selectedConversation();
      if (conversation) this.messages.set(await this.whatsapp.getMessages(conversation.id));
    } catch (err: unknown) {
      this.logger.error('Failed to retry WhatsApp message', err);
      this.toast.show('Could not retry this message.', 'danger');
    } finally {
      this.retryingMessageIds.update((ids) => {
        const next = new Set(ids);
        next.delete(message.id);
        return next;
      });
    }
  }

  async loadTemplates(): Promise<void> {
    try {
      this.templates.set(await this.whatsapp.getTemplates());
    } catch (err: unknown) {
      this.logger.error('Failed to load WhatsApp templates', err);
    }
  }

  /** Selecting a template resets its parameter inputs to one empty slot per
   *  `{{n}}` placeholder, prefilled with Meta's example values where given. */
  onTemplateSelected(name: string): void {
    this.selectedTemplateName.set(name);
    const template = this.templates().find((t) => t.name === name);
    if (!template) {
      this.templateParameters.set([]);
      return;
    }
    this.templateParameters.set(
      Array.from({ length: template.variableCount }, (_, i) => template.exampleValues[i] ?? ''),
    );
  }

  setTemplateParameter(index: number, value: string): void {
    this.templateParameters.update((values) => {
      const next = [...values];
      next[index] = value;
      return next;
    });
  }

  async sendTemplate(): Promise<void> {
    const conversation = this.selectedConversation();
    const template = this.selectedTemplate();
    if (!conversation || !template || this.sending() || !this.templateReadyToSend()) return;
    this.sending.set(true);
    try {
      const message = await this.whatsapp.sendTemplate(conversation.id, {
        name: template.name,
        language: template.language,
        parameters: this.templateParameters(),
      });
      this.messages.update((msgs) => [...msgs, message]);
      this.showTemplatePicker.set(false);
      this.selectedTemplateName.set('');
      this.templateParameters.set([]);
    } catch (err: unknown) {
      this.logger.error('Failed to send WhatsApp template', err);
      this.toast.show(
        err instanceof Error ? err.message : 'Could not send this template.',
        'danger',
      );
    } finally {
      this.sending.set(false);
    }
  }
}
