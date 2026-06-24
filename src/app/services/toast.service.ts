import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly message = signal<ToastMessage | null>(null);

  show(text: string, tone: ToastTone = 'info', durationMs = 3600): void {
    const toast = { id: this.nextId++, text, tone };
    this.message.set(toast);

    window.setTimeout(() => {
      if (this.message()?.id === toast.id) {
        this.message.set(null);
      }
    }, durationMs);
  }

  dismiss(): void {
    this.message.set(null);
  }
}
