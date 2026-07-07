import { Component, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lifespan-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="lifespan-badge" [class]="'severity-' + status().severity">
      <i class="bi bi-clock"></i> {{ status().text }}
    </span>
  `
})
export class LifespanBadgeComponent implements OnInit, OnDestroy {
  @Input({ required: true }) createdAt!: string;
  @Input({ required: true }) expiresIn!: number;

  protected readonly status = signal<{ text: string; severity: 'low' | 'medium' | 'high' }>({ text: '', severity: 'low' });
  private intervalId?: any;

  ngOnInit(): void {
    this.updateStatus();
    // Only run interval if not already expired
    if (this.status().text !== 'Expired') {
      this.intervalId = setInterval(() => {
        this.updateStatus();
      }, 15000);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private updateStatus(): void {
    if (!this.createdAt || !this.expiresIn) {
      this.status.set({ text: 'Expired', severity: 'high' });
      this.clearTimer();
      return;
    }

    const created = new Date(this.createdAt).getTime();
    const expiresAt = created + this.expiresIn * 60 * 1000;
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      this.status.set({ text: 'Expired', severity: 'high' });
      this.clearTimer();
      return;
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    let text = '';
    if (hours > 0) {
      text = `${hours}h ${minutes}m left`;
    } else {
      text = `${minutes}m left`;
    }

    let severity: 'low' | 'medium' | 'high' = 'low';
    if (remainingMs < 15 * 60 * 1000) {
      severity = 'high';
    } else if (remainingMs < 2 * 60 * 60 * 1000) {
      severity = 'medium';
    }

    this.status.set({ text, severity });
  }

  private clearTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
