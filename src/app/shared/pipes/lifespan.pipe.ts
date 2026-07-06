import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'lifespan',
  standalone: true,
})
export class LifespanPipe implements PipeTransform {
  transform(createdAt: string, expiresInMinutes: number, ticker?: any): { text: string; severity: 'low' | 'medium' | 'high' } {
    if (!createdAt || !expiresInMinutes) return { text: 'Expired', severity: 'high' };

    const created = new Date(createdAt).getTime();
    const expiresAt = created + expiresInMinutes * 60 * 1000;
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      return { text: 'Expired', severity: 'high' };
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

    return { text, severity };
  }
}
