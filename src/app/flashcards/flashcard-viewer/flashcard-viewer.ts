import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FlashcardService } from '../../services/flashcard.service';
import { FlashcardDeck } from '../../models/flashcard.model';
import { fadeInUp, scaleIn } from '../../shared/animations';

// Composant pour réviser les fiches : affiche une fiche à la fois avec effet de retournement
@Component({
  selector: 'app-flashcard-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './flashcard-viewer.html',
  styleUrl: './flashcard-viewer.scss',
  animations: [fadeInUp, scaleIn]
})
export class FlashcardViewerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flashcardService = inject(FlashcardService);

  // Le paquet de fiches en cours de révision
  protected readonly deck = signal<FlashcardDeck | undefined>(undefined);
  // Index de la fiche actuellement affichée
  protected readonly currentIndex = signal(0);
  // Est-ce que la fiche est retournée (montre le verso) ?
  protected readonly flipped = signal(false);
  // Est-ce que toutes les fiches ont été parcourues ?
  protected readonly finished = signal(false);

  // La fiche actuellement visible
  protected readonly currentCard = computed(() => {
    const d = this.deck();
    return d?.cards[this.currentIndex()];
  });

  // Progression en pourcentage (ex: 3/10 = 30%)
  protected readonly progress = computed(() => {
    const d = this.deck();
    if (!d || d.cards.length === 0) return 0;
    return Math.round(((this.currentIndex() + 1) / d.cards.length) * 100);
  });

  constructor() {
    // On charge le paquet depuis l'ID dans l'URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      const deck = this.flashcardService.getDeck(id);
      if (deck && deck.cards.length > 0) {
        this.deck.set(deck);
      } else {
        // Si le paquet n'existe pas ou est vide, retour aux dossiers
        this.router.navigate(['/folders']);
      }
    }
  }

  // Retourne la fiche (recto ↔ verso)
  flip(): void {
    this.flipped.update(f => !f);
  }

  // Passe à la fiche suivante
  next(): void {
    const d = this.deck();
    if (!d) return;
    if (this.currentIndex() < d.cards.length - 1) {
      this.currentIndex.update(i => i + 1);
      this.flipped.set(false); // On remet la fiche côté recto
    } else {
      this.finished.set(true); // C'est fini, toutes les fiches ont été vues
    }
  }

  // Revient à la fiche précédente
  previous(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
      this.flipped.set(false);
    }
  }

  // Recommence depuis le début
  restart(): void {
    this.currentIndex.set(0);
    this.flipped.set(false);
    this.finished.set(false);
  }
}
