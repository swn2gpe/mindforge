import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FlashcardService } from '../../services/flashcard.service';
import { AiService } from '../../services/ai.service';
import { Flashcard } from '../../models/flashcard.model';

// Composant pour créer ou modifier un paquet de fiches de révision
// Supporte l'import de fichiers (.txt, .docx, .pptx) + génération automatique par l'IA
@Component({
  selector: 'app-flashcard-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './flashcard-editor.html',
  styleUrl: './flashcard-editor.scss'
})
export class FlashcardEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flashcardService = inject(FlashcardService);
  private readonly http = inject(HttpClient);
  protected readonly aiService = inject(AiService);

  // Est-ce qu'on crée un nouveau paquet ou qu'on en modifie un existant ?
  protected readonly isNew: boolean;
  private readonly deckId: string | null;
  private readonly folderId: string | null; // Dossier dans lequel ranger le paquet

  // Champ pour le titre du paquet
  protected readonly titleControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  // Liste des fiches ajoutées
  protected readonly cards = signal<Flashcard[]>([]);
  // Indique si la sauvegarde est en cours
  protected readonly saving = signal(false);
  // Message d'erreur à afficher
  protected readonly error = signal('');
  // Indique si l'extraction du fichier est en cours
  protected readonly extracting = signal(false);
  // Indique si la génération IA des fiches est en cours
  protected readonly generating = signal(false);
  // Nom du fichier importé
  protected readonly importedFileName = signal('');

  // Formulaire pour ajouter/modifier une fiche (recto + verso)
  protected readonly cardForm = new FormGroup({
    front: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    back: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  // Index de la fiche en cours de modification (null = on en ajoute une nouvelle)
  protected readonly editingIndex = signal<number | null>(null);

  constructor() {
    // On récupère l'ID du paquet et le dossier depuis l'URL
    this.deckId = this.route.snapshot.paramMap.get('id');
    this.isNew = !this.deckId; // Pas d'ID = création (route /flashcards/new n'a pas de :id)
    this.folderId = this.route.snapshot.queryParamMap.get('folder');

    // Si on modifie un paquet existant, on charge ses données
    if (!this.isNew && this.deckId) {
      const deck = this.flashcardService.getDeck(this.deckId);
      if (deck) {
        this.titleControl.setValue(deck.title);
        this.cards.set([...deck.cards]);
      }
    }
  }

  // Ajoute une nouvelle fiche ou sauvegarde la modification en cours
  addCard(): void {
    if (this.cardForm.invalid) return;
    const { front, back } = this.cardForm.getRawValue();
    const editing = this.editingIndex();

    if (editing !== null) {
      // Mode modification : on remplace la fiche existante
      this.cards.update(c => c.map((card, i) =>
        i === editing ? { ...card, front, back } : card
      ));
      this.editingIndex.set(null);
    } else {
      // Mode ajout : on crée une nouvelle fiche avec un ID incrémental
      const nextId = this.cards().length > 0 ? Math.max(...this.cards().map(c => c.id)) + 1 : 1;
      this.cards.update(c => [...c, { id: nextId, front, back }]);
    }
    this.cardForm.reset();
  }

  // Active le mode modification pour une fiche donnée
  editCard(index: number): void {
    const card = this.cards()[index];
    this.cardForm.controls.front.setValue(card.front);
    this.cardForm.controls.back.setValue(card.back);
    this.editingIndex.set(index);
  }

  // Annule la modification en cours
  cancelEdit(): void {
    this.editingIndex.set(null);
    this.cardForm.reset();
  }

  // Supprime une fiche du paquet
  removeCard(index: number): void {
    this.cards.update(c => c.filter((_, i) => i !== index));
    if (this.editingIndex() === index) {
      this.cancelEdit();
    }
  }

  // Sauvegarde le paquet (création ou mise à jour)
  save(): void {
    if (this.titleControl.invalid || this.cards().length === 0) return;
    this.saving.set(true);
    this.error.set('');
    const title = this.titleControl.value;
    const cards = this.cards();

    if (this.isNew) {
      // Création : on envoie au serveur et on redirige vers la page de révision
      this.flashcardService.createDeck(title, this.folderId, cards).subscribe({
        next: deck => {
          this.saving.set(false);
          this.router.navigate(['/flashcards', deck.id]);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Erreur lors de la sauvegarde. Vérifiez que le serveur est lancé.');
        }
      });
    } else if (this.deckId) {
      // Modification : on met à jour le paquet existant
      this.flashcardService.updateDeck(this.deckId, { title, cards }).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/flashcards', this.deckId]);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Erreur lors de la mise à jour.');
        }
      });
    }
  }

  // Import d'un fichier (.txt, .docx, .pptx) → extraction du texte → génération de fiches par l'IA
  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const name = file.name.toLowerCase();
    this.error.set('');
    this.importedFileName.set(file.name);

    if (name.endsWith('.txt')) {
      // Fichier texte : lecture directe côté client
      const reader = new FileReader();
      reader.onload = () => this.generateFromText(reader.result as string);
      reader.readAsText(file);
    } else if (name.endsWith('.docx') || name.endsWith('.pptx') || name.endsWith('.pdf')) {
      // Fichier Word, PowerPoint ou PDF : envoi au serveur pour extraction
      this.extracting.set(true);
      const formData = new FormData();
      formData.append('file', file);

      this.http.post<{ text: string }>('/api/upload/extract-text', formData).subscribe({
        next: (res) => {
          this.extracting.set(false);
          this.generateFromText(res.text);
        },
        error: (err) => {
          this.extracting.set(false);
          this.importedFileName.set('');
          this.error.set(err.error?.error ?? 'Erreur lors de l\'extraction du texte.');
        }
      });
    } else {
      this.importedFileName.set('');
      this.error.set('Format non supporté. Utilisez .txt, .docx, .pptx ou .pdf');
    }
  }

  // Envoie le texte extrait à l'IA pour générer des fiches automatiquement
  private generateFromText(text: string): void {
    if (!text.trim()) {
      this.error.set('Aucun texte n\'a pu être extrait du fichier.');
      this.importedFileName.set('');
      return;
    }

    this.generating.set(true);
    this.aiService.generateFlashcards(text).subscribe({
      next: (result) => {
        this.generating.set(false);
        // Remplit le titre si vide
        if (!this.titleControl.value) {
          this.titleControl.setValue(result.title);
        }
        // Ajoute les fiches générées aux fiches existantes
        const existingCount = this.cards().length;
        const newCards = result.cards.map((c, i) => ({
          ...c,
          id: existingCount + i + 1
        }));
        this.cards.update(c => [...c, ...newCards]);
      },
      error: (err) => {
        this.generating.set(false);
        if (err.status === 401) {
          this.error.set('Clé API invalide. Vérifiez vos paramètres.');
        } else {
          this.error.set('Erreur lors de la génération des fiches par l\'IA.');
        }
      }
    });
  }
}
