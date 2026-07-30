import { Injectable, signal, effect, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { readLocalStorage, writeLocalStorage } from '../utils/local-storage.util';

import { FeatureFlagsService } from './feature-flags.service';

export type AppTheme = 'light' | 'dark' | 'midnight' | 'forest' | 'sepia';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly featureFlags = inject(FeatureFlagsService);
  public readonly currentTheme = signal<AppTheme>('light');

  public readonly availableThemes = computed<AppTheme[]>(() => {
    return this.featureFlags.enableExtraThemes()
      ? ['light', 'dark', 'midnight', 'forest', 'sepia']
      : ['light', 'dark'];
  });

  public readonly isDarkMode = computed(() => {
    const theme = this.currentTheme();
    return theme === 'dark' || theme === 'midnight' || theme === 'forest';
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = readLocalStorage<AppTheme | null>('tagmate:device:theme', null);
      const validThemes = this.availableThemes();
      if (stored && validThemes.includes(stored)) {
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
        writeLocalStorage('tagmate:device:theme', theme);
      }
    });
  }

  setTheme(theme: AppTheme) {
    if (this.availableThemes().includes(theme)) {
      this.currentTheme.set(theme);
    } else {
      this.currentTheme.set('dark');
    }
  }

  toggleTheme() {
    const themes = this.availableThemes();
    const currentIdx = themes.indexOf(this.currentTheme());
    const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % themes.length;
    this.currentTheme.set(themes[nextIdx]);
  }
}
