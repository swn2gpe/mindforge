import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Mindmap, MindmapNode } from '../models/mindmap.model';
import { AuthService } from './auth.service';

// Service pour gérer les cartes mentales (CRUD via l'API)
@Injectable({ providedIn: 'root' })
export class MindmapService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Liste de toutes les cartes mentales de l'utilisateur
  readonly mindmaps = signal<Mindmap[]>([]);

  constructor() {
    // Quand l'utilisateur se connecte/déconnecte, on recharge les cartes
    effect(() => {
      if (this.authService.currentUser()) {
        this.load();
      } else {
        this.mindmaps.set([]);
      }
    });
  }

  // Cherche une carte mentale par son ID
  getMindmap(id: string): Mindmap | undefined {
    return this.mindmaps().find(m => m.id === id);
  }

  // Récupère les cartes dans un dossier donné
  getMindmapsInFolder(folderId: string | null): Mindmap[] {
    return this.mindmaps().filter(m => m.folderId === folderId);
  }

  // Crée une nouvelle carte mentale et retourne un Observable
  createMindmap(title: string, root: MindmapNode, folderId: string | null = null): Observable<Mindmap> {
    return this.http.post<Mindmap>('/api/mindmaps', { title, folderId, root }).pipe(
      tap(mindmap => this.mindmaps.update(m => [...m, mindmap])) // Ajout à la liste locale
    );
  }

  // Met à jour une carte mentale existante
  updateMindmap(id: string, data: Partial<Pick<Mindmap, 'title' | 'folderId' | 'root'>>): Observable<Mindmap> {
    return this.http.put<Mindmap>(`/api/mindmaps/${encodeURIComponent(id)}`, data).pipe(
      tap(updated => this.mindmaps.update(m => m.map(item => item.id === id ? updated : item)))
    );
  }

  // Supprime une carte mentale
  deleteMindmap(id: string): void {
    this.http.delete(`/api/mindmaps/${encodeURIComponent(id)}`).subscribe(() => {
      this.mindmaps.update(m => m.filter(item => item.id !== id));
    });
  }

  // Charge toutes les cartes mentales depuis l'API
  private load(): void {
    this.http.get<Mindmap[]>('/api/mindmaps').subscribe(mindmaps => this.mindmaps.set(mindmaps));
  }
}
