import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

// Définition de toutes les routes (pages) de l'application
// Chaque composant est chargé en lazy loading (chargé uniquement quand on en a besoin)
export const routes: Routes = [
  // --- Pages accessibles uniquement aux visiteurs NON connectés ---
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register/register').then(m => m.RegisterComponent)
  },

  // --- Pages accessibles uniquement aux utilisateurs connectés ---
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent) // Page d'accueil
  },
  {
    path: 'generate',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz/quiz-generator/quiz-generator').then(m => m.QuizGeneratorComponent) // Générer un quiz
  },
  {
    path: 'quiz/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz/quiz-player/quiz-player').then(m => m.QuizPlayerComponent) // Jouer un quiz
  },
  {
    path: 'quiz/:id/result',
    canActivate: [authGuard],
    loadComponent: () => import('./quiz/quiz-result/quiz-result').then(m => m.QuizResultComponent) // Résultat d'un quiz
  },
  {
    path: 'folders',
    canActivate: [authGuard],
    loadComponent: () => import('./folders/folders').then(m => m.FoldersComponent) // Navigateur de dossiers (racine)
  },
  {
    path: 'folders/:folderId',
    canActivate: [authGuard],
    loadComponent: () => import('./folders/folders').then(m => m.FoldersComponent) // Navigateur de dossiers (sous-dossier)
  },
  {
    path: 'flashcards/new',
    canActivate: [authGuard],
    loadComponent: () => import('./flashcards/flashcard-editor/flashcard-editor').then(m => m.FlashcardEditorComponent) // Créer un paquet de fiches
  },
  {
    path: 'flashcards/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./flashcards/flashcard-viewer/flashcard-viewer').then(m => m.FlashcardViewerComponent) // Réviser des fiches
  },
  {
    path: 'flashcards/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./flashcards/flashcard-editor/flashcard-editor').then(m => m.FlashcardEditorComponent) // Modifier un paquet de fiches
  },
  {
    path: 'mindmaps/new',
    canActivate: [authGuard],
    loadComponent: () => import('./mindmaps/mindmap-editor/mindmap-editor').then(m => m.MindmapEditorComponent) // Créer une carte mentale
  },
  {
    path: 'mindmaps/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./mindmaps/mindmap-viewer/mindmap-viewer').then(m => m.MindmapViewerComponent) // Voir une carte mentale
  },
  {
    path: 'mindmaps/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./mindmaps/mindmap-editor/mindmap-editor').then(m => m.MindmapEditorComponent) // Modifier une carte mentale
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./settings/settings').then(m => m.SettingsComponent) // Paramètres (clé API)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./profile/profile').then(m => m.ProfileComponent) // Page de profil utilisateur
  },
  {
    path: '**',
    redirectTo: ''
  }
];
