import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { QuizService } from '../services/quiz.service';
import { AiService } from '../services/ai.service';
import { fadeInUp, scaleIn, staggerList, staggerItem } from '../shared/animations';

// Page d'accueil : affiche les stats et les derniers quiz
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  animations: [fadeInUp, scaleIn, staggerList, staggerItem]
})
export class DashboardComponent {
  protected readonly quizService = inject(QuizService);
  protected readonly aiService = inject(AiService);

  // Supprime un quiz et ses résultats associés
  deleteQuiz(id: string): void {
    this.quizService.deleteQuiz(id);
  }
}
