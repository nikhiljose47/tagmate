import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'quest';

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private queue: ToastMessage[] = [];
  
  readonly message = signal<ToastMessage | null>(null);

  show(text: string, tone: ToastTone = 'info', durationMs = 3600): void {
    const toast = { id: this.nextId++, text, tone, durationMs };
    this.queue.push(toast);

    if (!this.message()) {
      this.showNext();
    }
  }

  private showNext(): void {
    if (this.queue.length === 0) {
      this.message.set(null);
      return;
    }

    const nextToast = this.queue[0];
    this.message.set(nextToast);

    const duration = nextToast.durationMs ?? 3600;
    setTimeout(() => {
      const current = this.message();
      if (current?.id === nextToast.id) {
        this.dismissCurrentAndShowNext();
      }
    }, duration);
  }

  private dismissCurrentAndShowNext(): void {
    if (this.queue.length > 0) {
      this.queue.shift();
    }
    this.showNext();
  }

  dismiss(): void {
    this.dismissCurrentAndShowNext();
  }
}
