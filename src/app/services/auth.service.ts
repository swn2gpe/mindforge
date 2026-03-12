import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';

// Service d'authentification : gère la connexion, l'inscription et la session
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly TOKEN_KEY = 'quiz-app-token'; // Clé pour stocker le token dans le navigateur

  // Signal qui contient l'utilisateur connecté (ou null si pas connecté)
  readonly currentUser = signal<User | null>(null);
  // Calcul automatique : vrai si un utilisateur est connecté
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  constructor() {
    // Au démarrage, on essaie de restaurer la session précédente
    this.restoreSession();
  }

  // Inscription : envoie email, nom et mot de passe au serveur
  async register(email: string, displayName: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ token: string; user: User }>('/api/auth/register', { email, displayName, password })
      );
      // On sauvegarde le token reçu et on met à jour l'utilisateur
      localStorage.setItem(this.TOKEN_KEY, response.token);
      this.currentUser.set(response.user);
      return { success: true };
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? 'Erreur lors de l\'inscription.';
      return { success: false, error: message };
    }
  }

  // Connexion : envoie email et mot de passe au serveur
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ token: string; user: User }>('/api/auth/login', { email, password })
      );
      // On sauvegarde le token reçu et on met à jour l'utilisateur
      localStorage.setItem(this.TOKEN_KEY, response.token);
      this.currentUser.set(response.user);
      return { success: true };
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? 'Email ou mot de passe incorrect.';
      return { success: false, error: message };
    }
  }

  // Déconnexion : on efface tout
  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(this.TOKEN_KEY);
  }

  // Récupère le token JWT stocké dans le navigateur
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Restaure la session : si un token existe, on demande au serveur les infos de l'utilisateur
  private async restoreSession(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      const user = await firstValueFrom(
        this.http.get<User>('/api/auth/profile')
      );
      this.currentUser.set(user);
    } catch {
      // Si le token est invalide/expiré, on le supprime
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }
}
