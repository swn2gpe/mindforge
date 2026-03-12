import { Injectable, signal, effect } from '@angular/core';

// Service pour gérer le thème clair / sombre
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'quiz-app-theme'; // Clé de sauvegarde dans le navigateur
  // Signal : vrai si le thème sombre est activé
  readonly isDark = signal(this.loadTheme());

  constructor() {
    // À chaque changement du signal, on applique le thème sur la page
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
      localStorage.setItem(this.STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    });
  }

  // Bascule entre mode clair et sombre
  toggle(): void {
    this.isDark.update(v => !v);
  }

  // Charge le thème sauvegardé ou utilise la préférence du système
  private loadTheme(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
