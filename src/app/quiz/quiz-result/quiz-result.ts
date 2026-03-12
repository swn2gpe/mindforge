import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { Quiz, QuizResult, QuizAnswer, QuestionType } from '../../models/quiz.model';
import { scorePop, fadeInUp, staggerList, staggerItem } from '../../shared/animations';

// Composant pour afficher le résultat après avoir terminé un quiz
// Montre le score, les corrections, et les explications
@Component({
  selector: 'app-quiz-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './quiz-result.html',
  styleUrl: './quiz-result.scss',
  animations: [scorePop, fadeInUp, staggerList, staggerItem]
})
export class QuizResultComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);

  protected readonly quiz = signal<Quiz | undefined>(undefined);
  protected readonly result = signal<QuizResult | undefined>(undefined);

  // Score en pourcentage (ex: 7/10 = 70%)
  protected readonly scorePercentage = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return Math.round((r.score / r.totalQuestions) * 100);
  });

  // Message d'encouragement en fonction du score
  protected readonly scoreMessage = computed(() => {
    const pct = this.scorePercentage();
    if (pct >= 90) return 'Excellent ! 🎉';
    if (pct >= 70) return 'Très bien ! 👏';
    if (pct >= 50) return 'Pas mal ! 💪';
    return 'Continuez à réviser ! 📚';
  });

  // Associe chaque question avec la réponse de l'utilisateur pour l'affichage
  protected readonly questionsWithAnswers = computed(() => {
    const q = this.quiz();
    const r = this.result();
    if (!q || !r) return [];
    return q.questions.map(question => ({
      question,
      answer: r.answers.find(a => a.questionId === question.id)
    }));
  });

  constructor() {
    const quizId = this.route.snapshot.paramMap.get('id');
    if (quizId) {
      const quiz = this.quizService.getQuiz(quizId);
      // On essaie d'abord le résultat courant, sinon le dernier résultat enregistré
      const result = this.quizService.currentResult()
        ?? this.quizService.getResultsForQuiz(quizId).at(-1);

      if (quiz && result) {
        this.quiz.set(quiz);
        this.result.set(result);
      } else {
        this.router.navigate(['/']);
      }
    }
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
