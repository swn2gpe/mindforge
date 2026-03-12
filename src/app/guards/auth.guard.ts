import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guard pour les pages protégées : redirige vers /login si l'utilisateur n'est pas connecté
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true; // L'utilisateur est connecté, on le laisse passer
  }

  return router.createUrlTree(['/login']); // Pas connecté → page de connexion
};

// Guard pour les pages "invité" (login, register) : redirige vers l'accueil si déjà connecté
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true; // Pas connecté, on le laisse accéder au login/register
  }

  return router.createUrlTree(['/']); // Déjà connecté → redirection vers l'accueil
};
