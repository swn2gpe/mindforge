import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// Intercepteur HTTP : ajoute automatiquement le token JWT dans les requêtes vers l'API
// Sans ça, le serveur ne saurait pas qui est connecté
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Si on a un token ET que la requête va vers notre API, on ajoute le header
  if (token && req.url.startsWith('/api')) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }

  // Sinon, on laisse passer la requête telle quelle
  return next(req);
};
