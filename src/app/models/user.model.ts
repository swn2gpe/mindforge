// Données publiques d'un utilisateur
export interface User {
  id: string;           // Identifiant unique
  email: string;        // Adresse email
  displayName: string;  // Nom affiché
  createdAt: string;    // Date de création du compte
  avatarUrl?: string;   // URL de la photo de profil (optionnel)
}

// Utilisateur stocké en base (avec le mot de passe hashé)
export interface StoredUser extends User {
  passwordHash: string; // Mot de passe chiffré (jamais en clair)
}

// État de connexion de l'utilisateur
export interface AuthState {
  user: User | null;       // L'utilisateur connecté (ou null)
  isAuthenticated: boolean; // Est-ce qu'il est connecté ?
}
