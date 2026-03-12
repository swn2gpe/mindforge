import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { Quiz, QuestionType } from '../../models/quiz.model';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar';
import { fadeInUp } from '../../shared/animations';
import { trigger, transition, style, animate } from '@angular/animations';

// Animation de glissement entre les questions (gauche ↔ droite selon la direction)
const questionSlide = trigger('questionSlide', [
  transition(':increment', [
    style({ opacity: 0, transform: 'translateX(60px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
  ]),
  transition(':decrement', [
    style({ opacity: 0, transform: 'translateX(-60px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
  ])
]);

// Composant pour jouer un quiz : affiche les questions une par une
@Component({
  selector: 'app-quiz-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent],
  templateUrl: './quiz-player.html',
  styleUrl: './quiz-player.scss',
  animations: [fadeInUp, questionSlide]
})
export class QuizPlayerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);

  // Le quiz en cours
  protected readonly quiz = signal<Quiz | undefined>(undefined);
  // Index de la question actuelle
  protected readonly currentIndex = signal(0);
  // Map qui stocke les réponses de l'utilisateur (numéro question → réponse)
  protected readonly answers = signal(new Map<number, string>());

  // La question actuellement affichée
  protected readonly currentQuestion = computed(() => {
    const q = this.quiz();
    return q ? q.questions[this.currentIndex()] : undefined;
  });

  // Vérifie si toutes les questions ont une réponse (pour activer le bouton "Terminer")
  protected readonly allAnswered = computed(() => {
    const q = this.quiz();
    if (!q) return false;
    return q.questions.every(question => {
      const answer = this.answers().get(question.id);
      return answer !== undefined && answer.trim().length > 0;
    });
  });

  constructor() {
    // On charge le quiz depuis l'ID dans l'URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const quiz = this.quizService.getQuiz(id);
      if (quiz) {
        this.quiz.set(quiz);
      } else {
        this.router.navigate(['/']); // Quiz introuvable, retour à l'accueil
      }
    }
  }

  // Enregistre la réponse de l'utilisateur pour une question
  selectAnswer(questionId: number, answer: string): void {
    this.answers.update(map => {
      const newMap = new Map(map);
      newMap.set(questionId, answer);
      return newMap;
    });
  }

  // Gère la saisie de texte pour les questions ouvertes
  onOpenAnswer(questionId: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.selectAnswer(questionId, value);
  }

  // Passe à la question précédente
  previous(): void {
    this.currentIndex.update(i => Math.max(0, i - 1));
  }

  // Passe à la question suivante
  next(): void {
    const q = this.quiz();
    if (q) {
      this.currentIndex.update(i => Math.min(q.questions.length - 1, i + 1));
    }
  }

  // Termine le quiz : corrige les réponses et redirige vers la page résultat
  finish(): void {
    const q = this.quiz();
    if (!q) return;
    this.quizService.evaluateAnswers(q, this.answers());
    this.router.navigate(['/quiz', q.id, 'result']);
  }

  // Retourne le libellé français du type de question
  typeLabel(type: QuestionType): string {
    switch (type) {
      case 'mcq': return 'QCM';
      case 'true-false': return 'Vrai / Faux';
      case 'open': return 'Question ouverte';
    }
  }
}
