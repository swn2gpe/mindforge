import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AiService } from '../../services/ai.service';
import { QuizService } from '../../services/quiz.service';
import { FlashcardService } from '../../services/flashcard.service';
import { fadeInUp } from '../../shared/animations';

// Composant pour générer un quiz à partir d'un texte collé ou d'un fichier importé
// Supporte : .txt, .docx (Word), .pptx (PowerPoint)
@Component({
  selector: 'app-quiz-generator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './quiz-generator.html',
  styleUrl: './quiz-generator.scss',
  animations: [fadeInUp]
})
export class QuizGeneratorComponent {
  protected readonly aiService = inject(AiService);
  private readonly quizService = inject(QuizService);
  protected readonly flashcardService = inject(FlashcardService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  // État de chargement pendant la génération
  protected readonly loading = signal(false);
  // État de chargement pendant l'extraction du fichier
  protected readonly extracting = signal(false);
  // Message d'erreur à afficher
  protected readonly error = signal('');
  // Nom du fichier importé (pour l'afficher dans l'interface)
  protected readonly importedFileName = signal('');

  // Formulaire avec le champ texte (minimum 100 caractères)
  protected readonly form = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(100)]
    })
  });

  // Convertit un paquet de fiches en texte pour le quiz
  onDeckSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const deckId = select.value;
    if (!deckId) return;

    const deck = this.flashcardService.getDeck(deckId);
    if (deck) {
      const text = deck.cards
        .map(card => `Q: ${card.front}\nA: ${card.back}`)
        .join('\n\n');
      
      this.form.controls.text.setValue(text);
      this.importedFileName.set(`Paquet : ${deck.title}`);
      
      // Reset select
      select.value = '';
    }
  }

  // Permet d'importer un fichier (.txt, .docx, .pptx)
  // Les fichiers .txt sont lus directement, les autres sont envoyés au serveur pour extraction
  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ''; // On vide l'input pour pouvoir re-sélectionner le même fichier

    const name = file.name.toLowerCase();

    if (name.endsWith('.txt')) {
      // Fichier texte : lecture directe côté client
      const reader = new FileReader();
      reader.onload = () => {
        this.form.controls.text.setValue(reader.result as string);
        this.importedFileName.set(file.name);
      };
      reader.readAsText(file);
    } else if (name.endsWith('.docx') || name.endsWith('.pptx') || name.endsWith('.pdf')) {
      // Fichier Word, PowerPoint ou PDF : envoi au serveur pour extraction du texte
      this.extracting.set(true);
      this.error.set('');
      this.importedFileName.set(file.name);

      const formData = new FormData();
      formData.append('file', file);

      this.http.post<{ text: string }>('/api/upload/extract-text', formData).subscribe({
        next: (res) => {
          this.form.controls.text.setValue(res.text);
          this.extracting.set(false);
        },
        error: (err) => {
          this.extracting.set(false);
          this.importedFileName.set('');
          this.error.set(err.error?.error ?? 'Erreur lors de l\'extraction du texte du fichier.');
        }
      });
    } else {
      this.error.set('Format non supporté. Utilisez .txt, .docx, .pptx ou .pdf');
    }
  }

  // Lance la génération du quiz via l'IA
  generate(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const text = this.form.controls.text.value;

    // Étape 1 : l'IA génère les questions à partir du texte
    this.aiService.generateQuiz(text).subscribe({
      next: (generated) => {
        // Étape 2 : on sauvegarde le quiz dans la base de données
        this.quizService.createQuiz(generated, text).subscribe({
          next: (quiz) => {
            this.loading.set(false);
            // Redirection vers le quiz créé pour le commencer
            this.router.navigate(['/quiz', quiz.id]);
          },
          error: () => {
            this.loading.set(false);
            this.error.set('Erreur lors de la sauvegarde du quiz.');
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        // Messages d'erreur adaptés selon le type de problème
        if (err.status === 401) {
          this.error.set('Clé API invalide. Vérifiez vos paramètres.');
        } else if (err.status === 429) {
          this.error.set('Trop de requêtes. Veuillez patienter avant de réessayer.');
        } else {
          this.error.set('Erreur lors de la génération du quiz. Vérifiez votre connexion et réessayez.');
        }
      }
    });
  }
}
