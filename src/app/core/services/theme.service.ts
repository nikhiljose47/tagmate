import { Injectable, signal, effect, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme = 'light' | 'dark' | 'midnight' | 'forest' | 'sepia';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  public readonly currentTheme = signal<AppTheme>('light');
  
  public readonly isDarkMode = computed(() => {
    const theme = this.currentTheme();
    return theme === 'dark' || theme === 'midnight' || theme === 'forest';
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('theme') as AppTheme;
      if (stored && ['light', 'dark', 'midnight', 'forest', 'sepia'].includes(stored)) {
        this.currentTheme.set(stored);
      } else if (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.currentTheme.set('dark');
      }
    }

    effect(() => {
      const theme = this.currentTheme();
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.classList.remove('dark', 'midnight', 'forest', 'sepia');
        if (theme !== 'light') {
          document.documentElement.classList.add(theme);
        }
        localStorage.setItem('theme', theme);
      }
    });
  }

  setTheme(theme: AppTheme) {
    this.currentTheme.set(theme);
  }

  toggleTheme() {
    const themes: AppTheme[] = ['light', 'dark', 'midnight', 'forest', 'sepia'];
    const currentIdx = themes.indexOf(this.currentTheme());
    const nextIdx = (currentIdx + 1) % themes.length;
    this.currentTheme.set(themes[nextIdx]);
  }
}
