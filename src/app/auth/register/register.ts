// Composant d'inscription (Register)
// Permet à un nouvel utilisateur de créer un compte

import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { scaleIn } from '../../shared/animations';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  animations: [scaleIn],
  template: `
    <div class="auth-page">
      <div class="auth-card" @scaleIn>
        <div class="auth-header">
          <span class="auth-icon" aria-hidden="true">🧠</span>
          <h1>Créer un compte</h1>
          <p>Rejoignez QuizAI et commencez à réviser intelligemment</p>
        </div>

        @if (error()) {
          <div class="alert alert-error" role="alert">
            <span aria-hidden="true">❌</span>
            <p>{{ error() }}</p>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label for="displayName">Nom d'affichage</label>
            <input
              id="displayName"
              type="text"
              formControlName="displayName"
              placeholder="Jean Dupont"
              autocomplete="name">
          </div>

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
              placeholder="Minimum 6 caractères"
              autocomplete="new-password">
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="Retapez votre mot de passe"
              autocomplete="new-password">
            @if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
              <small class="field-error">Les mots de passe ne correspondent pas.</small>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-lg auth-submit"
            [disabled]="form.invalid || loading()">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span> Création...
            } @else {
              Créer mon compte
            }
          </button>
        </form>

        <p class="auth-footer">
          Déjà un compte ?
          <a routerLink="/login">Se connecter</a>
        </p>
      </div>
    </div>
  `,
  styleUrl: './register.scss'
})
export class RegisterComponent {
  // Injection des services
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Signaux pour l'état du formulaire
  protected readonly loading = signal(false);  // Vrai pendant la requête d'inscription
  protected readonly error = signal('');        // Message d'erreur à afficher

  // Formulaire réactif avec tous les champs nécessaires à l'inscription
  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: this.passwordMatchValidator });

  // Validateur personnalisé : vérifie que les 2 mots de passe sont identiques
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  // Soumet le formulaire d'inscription
  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const { displayName, email, password } = this.form.getRawValue();
    // Appel au service d'authentification pour créer le compte
    const result = await this.authService.register(email, displayName, password);

    this.loading.set(false);

    if (result.success) {
      this.router.navigate(['/']); // Redirige vers le tableau de bord
    } else {
      this.error.set(result.error ?? 'Erreur lors de la création du compte.');
    }
  }
}
