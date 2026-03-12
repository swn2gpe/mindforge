import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common'; // Important for ngClass/Style if not standalone fully

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  template: \
    <header class="header">
      <div class="header-glass"></div>
      <div class="header-container">
        <!-- Logo -->
        <a routerLink="/" class="logo">
          <div class="logo-icon-wrapper">
            <span class="logo-icon">?</span>
          </div>
          <span class="logo-text">MindForge</span>
        </a>

        <!-- Desktop Nav -->
        @if (auth.isAuthenticated()) {
          <nav class="nav-desktop">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">
              <span class="nav-label">Accueil</span>
            </a>
            <a routerLink="/generate" routerLinkActive="active" class="nav-link">
              <span class="nav-label">? Nouveau</span>
            </a>
            <a routerLink="/folders" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Dossiers</span>
            </a>
            <a routerLink="/settings" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Réglages</span>
            </a>
          </nav>

          <!-- User Actions -->
          <div class="user-actions">
            <button
              class="theme-toggle"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.isDark() ? 'Mode clair' : 'Mode sombre'">
              <span class="theme-icon">{{ theme.isDark() ? '??' : '??' }}</span>
            </button>

            <a routerLink="/profile" class="user-profile" aria-label="Mon profil">
              @if (auth.currentUser()?.avatarUrl) {
                <img [src]="auth.currentUser()?.avatarUrl" alt="" class="avatar-img" />
              } @else {
                <div class="avatar-placeholder">{{ initials() }}</div>
              }
            </a>

            <!-- Mobile Toggle -->
            <button
              class="menu-toggle"
              (click)="toggleMenu()"
              [attr.aria-expanded]="menuOpen()"
              aria-label="Menu">
              <div class="hamburger" [class.open]="menuOpen()">
                <span></span><span></span><span></span>
              </div>
            </button>
          </div>
        } @else {
          <!-- Guest Nav -->
          <div style="flex:1"></div>
          <button
            class="theme-toggle"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? 'Mode clair' : 'Mode sombre'">
            <span class="theme-icon">{{ theme.isDark() ? '??' : '??' }}</span>
          </button>
          <a routerLink="/login" class="btn btn-primary" style="margin-left: 1rem;">Connexion</a>
        }
      </div>

      <!-- Mobile Nav Overlay -->
      <div class="mobile-nav" [class.open]="menuOpen()">
        <div class="mobile-nav-content">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">
            ?? Accueil
          </a>
          <a routerLink="/generate" routerLinkActive="active" (click)="closeMenu()">
            ? Créer un quiz
          </a>
          <a routerLink="/folders" routerLinkActive="active" (click)="closeMenu()">
            ?? Mes dossiers
          </a>
          <a routerLink="/settings" routerLinkActive="active" (click)="closeMenu()">
            ?? Paramètres
          </a>
          <div class="divider"></div>
          <button class="btn-logout-mobile" (click)="logout()">
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  \,
  styles: [\
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 1000;
      width: 100%;
    }

    .header {
      position: relative;
      width: 100%;
      height: 80px;
      display: flex;
      align-items: center;
      transition: all 0.3s ease;
    }

    .header-glass {
      position: absolute;
      inset: 0;
      background: rgba(var(--bg-surface-rgb), 0.8); /* Fallback */
      background: var(--bg-surface-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-glass);
      z-index: -1;
    }

    .header-container {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
    }

    /* Logo */
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      font-weight: 800;
      font-size: 1.5rem;
      letter-spacing: -0.03em;
      color: var(--text-main);
      transition: transform 0.2s;
    }

    .logo:hover {
      transform: scale(1.02);
    }

    .logo-icon-wrapper {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px -2px var(--primary-glow);
    }

    .logo-icon {
      font-size: 1.25rem;
      color: white;
    }

    .logo-text {
      background: linear-gradient(135deg, var(--text-main) 30%, var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Desktop Navigation */
    .nav-desktop {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-surface);
      padding: 0.35rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-glass);
      box-shadow: var(--shadow-sm);
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      border-radius: var(--radius-full);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
    }

    .nav-link:hover {
      color: var(--text-main);
      background: rgba(var(--primary-hue), 0.05);
    }

    .nav-link.active {
      background: var(--text-main);
      color: var(--bg-surface);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    [data-theme="dark"] .nav-link.active {
      background: var(--primary);
      color: white;
    }

    /* User Actions */
    .user-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .theme-toggle {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--border-glass);
      background: var(--bg-surface);
      color: var(--text-main);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.2s;
    }

    .theme-toggle:hover {
      transform: rotate(15deg);
      border-color: var(--primary);
      color: var(--primary);
    }

    .avatar-placeholder {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--secondary), var(--primary));
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      border: 2px solid var(--bg-surface);
      box-shadow: 0 0 0 2px var(--border-glass);
    }

    .avatar-img {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--bg-surface);
      box-shadow: 0 0 0 2px var(--border-glass);
    }

    /* Mobile Menu */
    .menu-toggle {
      display: none;
      width: 42px;
      height: 42px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      margin-left: 0.5rem;
      color: var(--text-main);
      align-items: center;
      justify-content: center;
    }

    .hamburger {
      width: 24px;
      height: 18px;
      position: relative;
    }

    .hamburger span {
      position: absolute;
      left: 0;
      width: 100%;
      height: 2px;
      background: currentColor;
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .hamburger span:nth-child(1) { top: 0; }
    .hamburger span:nth-child(2) { top: 8px; }
    .hamburger span:nth-child(3) { top: 16px; }

    .hamburger.open span:nth-child(1) { top: 8px; transform: rotate(45deg); }
    .hamburger.open span:nth-child(2) { opacity: 0; transform: translateX(10px); }
    .hamburger.open span:nth-child(3) { top: 8px; transform: rotate(-45deg); }

    .mobile-nav {
      position: fixed;
      top: 80px;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5); /* Dim background */
      backdrop-filter: blur(4px);
      z-index: 999;
      transform: translateY(-10px);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      justify-content: flex-end; /* Align right */
      padding: 1rem;
    }

    .mobile-nav.open {
      transform: translateY(0);
      opacity: 1;
      visibility: visible;
    }

    .mobile-nav-content {
      width: 100%;
      max-width: 300px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
      padding: 1rem;
      border: 1px solid var(--border-glass);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-shadow: var(--shadow-md);
    }

    .mobile-nav a {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-sm);
      color: var(--text-main);
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
    }

    .mobile-nav a:hover, .mobile-nav a.active {
      background: var(--input-bg);
      color: var(--primary);
    }

    .divider {
      height: 1px;
      background: var(--border-color);
      margin: 0.5rem 0;
    }

    .btn-logout-mobile {
      width: 100%;
      padding: 1rem;
      text-align: center;
      background: rgba(255, 71, 87, 0.1);
      color: var(--danger);
      border: none;
      border-radius: var(--radius-sm);
      font-weight: 600;
      cursor: pointer;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .nav-desktop { display: none; }
      .menu-toggle { display: flex; }
      .header-container { padding: 0 1rem; }
    }
  \]
})
export class HeaderComponent {
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
    this.closeMenu();
  }

  initials(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}
