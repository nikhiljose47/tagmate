import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends Required<ConfirmOptions> {
  id: number;
}

/**
 * App-wide replacement for browser `confirm()` — one dialog instance mounted
 * at the root (see AppComponent) so any service/component can await a decision
 * without owning dialog markup itself.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private nextId = 1;
  private resolver: ((result: boolean) => void) | null = null;

  readonly state = signal<ConfirmState | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    // Resolve any still-open prior request as cancelled before opening a new one.
    this.resolver?.(false);

    const id = this.nextId++;
    this.state.set({
      id,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      danger: options.danger ?? false,
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(result: boolean): void {
    this.resolver?.(result);
    this.resolver = null;
    this.state.set(null);
  }
}
