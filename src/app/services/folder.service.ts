import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Folder } from '../models/folder.model';
import { AuthService } from './auth.service';

// Service pour gérer les dossiers de classement (CRUD via l'API)
@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Liste de tous les dossiers de l'utilisateur
  readonly folders = signal<Folder[]>([]);

  constructor() {
    // Quand l'utilisateur se connecte/déconnecte, on recharge les dossiers
    effect(() => {
      if (this.authService.currentUser()) {
        this.load();
      } else {
        this.folders.set([]);
      }
    });
  }

  // Cherche un dossier par son ID
  getFolder(id: string): Folder | undefined {
    return this.folders().find(f => f.id === id);
  }

  // Récupère les sous-dossiers d'un dossier parent (null = racine)
  getChildren(parentId: string | null): Folder[] {
    return this.folders().filter(f => f.parentId === parentId);
  }

  // Crée un nouveau dossier
  create(name: string, parentId: string | null = null, color = '#6366f1'): void {
    this.http.post<Folder>('/api/folders', { name, parentId, color }).subscribe(folder => {
      this.folders.update(f => [...f, folder]);
    });
  }

  // Met à jour un dossier existant
  update(id: string, data: Partial<Pick<Folder, 'name' | 'parentId' | 'color'>>): void {
    this.http.put<Folder>(`/api/folders/${encodeURIComponent(id)}`, data).subscribe(updated => {
      this.folders.update(f => f.map(item => item.id === id ? updated : item));
    });
  }

  // Supprime un dossier (et tous ses sous-dossiers côté serveur)
  delete(id: string): void {
    this.http.delete(`/api/folders/${encodeURIComponent(id)}`).subscribe(() => {
      this.load(); // On recharge tout après suppression
    });
  }

  // Charge tous les dossiers depuis l'API
  private load(): void {
    this.http.get<Folder[]>('/api/folders').subscribe(folders => this.folders.set(folders));
  }
}
