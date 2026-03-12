import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { FlashcardDeck, Flashcard } from '../models/flashcard.model';
import { AuthService } from './auth.service';

// Service pour gérer les paquets de fiches de révision (CRUD via l'API)
@Injectable({ providedIn: 'root' })
export class FlashcardService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Liste de tous les paquets de fiches de l'utilisateur
  readonly decks = signal<FlashcardDeck[]>([]);

  constructor() {
    // Quand l'utilisateur se connecte/déconnecte, on recharge les paquets
    effect(() => {
      if (this.authService.currentUser()) {
        this.load();
      } else {
        this.decks.set([]);
      }
    });
  }

  // Cherche un paquet par son ID
  getDeck(id: string): FlashcardDeck | undefined {
    return this.decks().find(d => d.id === id);
  }

  // Récupère les paquets dans un dossier donné
  getDecksInFolder(folderId: string | null): FlashcardDeck[] {
    return this.decks().filter(d => d.folderId === folderId);
  }

  // Crée un nouveau paquet de fiches et retourne un Observable
  createDeck(title: string, folderId: string | null = null, cards: Flashcard[] = []): Observable<FlashcardDeck> {
    return this.http.post<FlashcardDeck>('/api/flashcard-decks', { title, folderId, cards }).pipe(
      tap(deck => this.decks.update(d => [...d, deck])) // On ajoute le paquet à la liste locale
    );
  }

  // Met à jour un paquet existant
  updateDeck(id: string, data: Partial<Pick<FlashcardDeck, 'title' | 'folderId' | 'cards'>>): Observable<FlashcardDeck> {
    return this.http.put<FlashcardDeck>(`/api/flashcard-decks/${encodeURIComponent(id)}`, data).pipe(
      tap(updated => this.decks.update(d => d.map(item => item.id === id ? updated : item)))
    );
  }

  // Supprime un paquet de fiches
  deleteDeck(id: string): void {
    this.http.delete(`/api/flashcard-decks/${encodeURIComponent(id)}`).subscribe(() => {
      this.decks.update(d => d.filter(item => item.id !== id));
    });
  }

  // Charge tous les paquets depuis l'API
  private load(): void {
    this.http.get<FlashcardDeck[]>('/api/flashcard-decks').subscribe(decks => this.decks.set(decks));
  }
}
