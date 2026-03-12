// Composant de connexion (Login)
// Permet à l'utilisateur de se connecter avec email/mot de passe

import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { scaleIn } from '../../shared/animations';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  animations: [scaleIn],
  template: `
    <div class="auth-page">
      <div class="auth-card" @scaleIn>
        <div class="auth-header">
          <span class="auth-icon" aria-hidden="true">🧠</span>
          <h1>Connexion</h1>
          <p>Connectez-vous pour accéder à vos quiz</p>
        </div>

        @if (error()) {
          <div class="alert alert-error" role="alert">
            <span aria-hidden="true">❌</span>
            <p>{{ error() }}</p>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="votre@email.com"
              autocomplete="email">
          </div>

          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              autocomplete="current-password">
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-lg auth-submit"
            [disabled]="form.invalid || loading()">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span> Connexion...
            } @else {
              Se connecter
            }
          </button>
        </form>

        <p class="auth-footer">
          Pas encore de compte ?
          <a routerLink="/register">Créer un compte</a>
        </p>
      </div>
    </div>
  `,
  styleUrl: './login.scss'
})
export class LoginComponent {
  // Injection des services nécessaires
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Signaux pour l'état du formulaire
  protected readonly loading = signal(false);  // Vrai pendant la requête de connexion
  protected readonly error = signal('');        // Message d'erreur à afficher

  // Formulaire réactif avec validation (email valide + mot de passe min 6 caractères)
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] })
  });

  // Soumet le formulaire de connexion
  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();
    // Appel au service d'authentification
    const result = await this.authService.login(email, password);

    this.loading.set(false);

    if (result.success) {
      this.router.navigate(['/']); // Redirige vers le tableau de bord
    } else {
      this.error.set(result.error ?? 'Erreur de connexion.');
    }
  }
}
