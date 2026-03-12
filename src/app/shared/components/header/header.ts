import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
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
          <span class="logo-icon" aria-hidden="true">🔥</span>
          <span class="logo-text">MindForge</span>
        </a>

        @if (auth.isAuthenticated()) {
          <!-- Bouton hamburger mobile -->
          <button
            class="menu-toggle"
            (click)="toggleMenu()"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="main-nav"
            aria-label="Menu de navigation"
            type="button">
            <span class="hamburger" [class.open]="menuOpen()">
              <span></span><span></span><span></span>
            </span>
          </button>

          <div class="nav-overlay" [class.visible]="menuOpen()" (click)="closeMenu()"></div>

          <nav class="nav" [class.open]="menuOpen()" id="main-nav" aria-label="Navigation principale">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">
              Accueil
            </a>
            <a routerLink="/generate" routerLinkActive="active" (click)="closeMenu()">
              Créer un quiz
            </a>
            <a routerLink="/folders" routerLinkActive="active" (click)="closeMenu()">
              Mes dossiers
            </a>
            <a routerLink="/settings" routerLinkActive="active" (click)="closeMenu()">
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
            <button class="btn btn-ghost btn-sm btn-logout" (click)="logout()" type="button">
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
      flex-shrink: 0;
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
      flex-shrink: 0;
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

    /* Hamburger - caché par défaut sur desktop */
    .menu-toggle {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      margin-left: auto;
    }
    .hamburger {
      display: flex;
      flex-direction: column;
      gap: 5px;
      width: 24px;
    }
    .hamburger span {
      display: block;
      height: 2px;
      background: var(--text-primary);
      border-radius: 2px;
      transition: all 0.3s;
    }
    .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.open span:nth-child(2) { opacity: 0; }
    .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    .nav-overlay {
      display: none;
    }

    /* ===== TABLET (max 900px) ===== */
    @media (max-width: 900px) {
      .header-container { gap: 1rem; padding: 0 1rem; }
      .nav a { padding: 0.4rem 0.7rem; font-size: 0.85rem; }
      .user-name { display: none; }
      .btn-logout { display: none; }
    }

    /* ===== MOBILE (max 640px) ===== */
    @media (max-width: 640px) {
      .menu-toggle {
        display: flex;
        order: 3;
      }
      .nav {
        display: none;
        position: fixed;
        top: 64px;
        left: 0;
        right: 0;
        bottom: 0;
        flex-direction: column;
        background: var(--surface);
        padding: 1rem;
        gap: 0.25rem;
        z-index: 200;
        overflow-y: auto;
      }
      .nav.open {
        display: flex;
      }
      .nav a {
        padding: 0.875rem 1rem;
        font-size: 1rem;
        border-radius: 12px;
      }
      .nav-overlay {
        position: fixed;
        inset: 0;
        top: 64px;
        background: rgba(0,0,0,0.4);
        z-index: 199;
      }
      .nav-overlay.visible {
        display: block;
      }
      .user-section {
        gap: 0.5rem;
        margin-left: auto;
      }
      .user-name { display: none; }
      .btn-logout { display: none; }
      .header-container { gap: 0.75rem; }
    }
  `]
})
export class HeaderComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // État du menu mobile (ouvert/fermé)
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

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
