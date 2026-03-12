import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';
import { AuthService } from '../../../services/auth.service';

// Barre de navigation en haut de la page
// Affiche le logo, les liens, le bouton thème et les infos utilisateur
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header-container">
        <a routerLink="/" class="logo">
          <span class="logo-icon" aria-hidden="true">🧠</span>
          <span class="logo-text">QuizAI</span>
        </a>

        @if (auth.isAuthenticated()) {
          <nav class="nav" aria-label="Navigation principale">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              Accueil
            </a>
            <a routerLink="/generate" routerLinkActive="active">
              Créer un quiz
            </a>
            <a routerLink="/folders" routerLinkActive="active">
              Mes dossiers
            </a>
            <a routerLink="/settings" routerLinkActive="active">
              Paramètres
            </a>
          </nav>

          <div class="user-section">
            <button
              class="theme-toggle"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.isDark() ? 'Activer le mode clair' : 'Activer le mode sombre'"
              type="button">
              {{ theme.isDark() ? '☀️' : '🌙' }}
            </button>
            <div class="user-info">
              <a routerLink="/profile" class="user-link" aria-label="Mon profil">
                @if (auth.currentUser()?.avatarUrl) {
                  <img [src]="auth.currentUser()?.avatarUrl" alt="" class="user-avatar-img" />
                } @else {
                  <span class="user-avatar" aria-hidden="true">{{ initials() }}</span>
                }
                <span class="user-name">{{ auth.currentUser()?.displayName }}</span>
              </a>
            </div>
            <button class="btn btn-ghost btn-sm" (click)="logout()" type="button">
              Déconnexion
            </button>
          </div>
        } @else {
          <div class="nav" style="flex:1"></div>
          <button
            class="theme-toggle"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? 'Activer le mode clair' : 'Activer le mode sombre'"
            type="button">
            {{ theme.isDark() ? '☀️' : '🌙' }}
          </button>
        }
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
    }
    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 64px;
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--text-primary);
    }
    .logo-icon { font-size: 1.5rem; }
    .nav {
      display: flex;
      gap: 0.25rem;
      flex: 1;
    }
    .nav a {
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      color: var(--text-secondary);
      font-weight: 500;
      transition: all 0.2s;
    }
    .nav a:hover {
      background: var(--hover);
      color: var(--text-primary);
    }
    .nav a.active {
      background: var(--primary-light);
      color: var(--primary);
    }
    .user-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .user-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-primary);
    }
    .user-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .user-link:hover {
      background: var(--hover);
    }
    .user-avatar-img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }
    .theme-toggle {
      background: var(--hover);
      border: none;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.25rem;
      transition: background 0.2s;
      line-height: 1;
    }
    .theme-toggle:hover {
      background: var(--border);
    }

    @media (max-width: 640px) {
      .header-container { gap: 0.5rem; padding: 0 1rem; }
      .nav a { padding: 0.4rem 0.6rem; font-size: 0.85rem; }
      .user-name { display: none; }
    }
  `]
})
export class HeaderComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Calcule les initiales du nom de l'utilisateur (ex: "Jean Dupont" → "JD")
  protected initials(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  // Déconnecte l'utilisateur et le redirige vers la page de connexion
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
