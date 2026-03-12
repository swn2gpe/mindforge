import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Quiz, QuizResult, QuizAnswer, GeneratedQuiz } from '../models/quiz.model';
import { AuthService } from './auth.service';

// Service pour gérer les quiz : création, suppression, évaluation des réponses
@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Liste de tous les quiz de l'utilisateur
  readonly quizzes = signal<Quiz[]>([]);
  // Liste de tous les résultats (scores) de l'utilisateur
  readonly results = signal<QuizResult[]>([]);
  // Le dernier résultat obtenu (pour afficher la page résultat)
  readonly currentResult = signal<QuizResult | null>(null);

  constructor() {
    // Quand l'utilisateur se connecte/déconnecte, on recharge les données
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadFromApi();
      } else {
        this.quizzes.set([]);
        this.results.set([]);
      }
    });
  }

  // Les 5 derniers quiz créés (triés par date décroissante)
  readonly recentQuizzes = computed(() =>
    this.quizzes()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  );

  // Calcule la moyenne des scores en pourcentage
  readonly averageScore = computed(() => {
    const allResults = this.results();
    if (allResults.length === 0) return 0;
    const total = allResults.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0);
    return Math.round(total / allResults.length);
  });

  // Crée un nouveau quiz à partir de ce que l'IA a généré
  createQuiz(generated: GeneratedQuiz, sourceText: string): Observable<Quiz> {
    const body = {
      title: generated.title,
      sourceText,
      questions: generated.questions.map((q, i) => ({ ...q, id: i + 1 })) // On ajoute un ID à chaque question
    };
    return this.http.post<Quiz>('/api/quizzes', body).pipe(
      tap(quiz => this.quizzes.update(quizzes => [...quizzes, quiz])) // On ajoute le quiz à la liste locale
    );
  }

  // Cherche un quiz par son ID
  getQuiz(id: string): Quiz | undefined {
    return this.quizzes().find(q => q.id === id);
  }

  // Supprime un quiz et ses résultats
  deleteQuiz(id: string): void {
    this.http.delete(`/api/quizzes/${encodeURIComponent(id)}`).subscribe(() => {
      this.quizzes.update(quizzes => quizzes.filter(q => q.id !== id));
      this.results.update(results => results.filter(r => r.quizId !== id));
    });
  }

  // Corrige les réponses de l'utilisateur et calcule le score
  evaluateAnswers(quiz: Quiz, userAnswers: Map<number, string>): void {
    // Pour chaque question, on vérifie si la réponse est correcte
    const answers: QuizAnswer[] = quiz.questions.map(q => {
      const userAnswer = userAnswers.get(q.id) ?? '';
      const isCorrect = q.type === 'open'
        ? this.evaluateOpenAnswer(userAnswer, q.correctAnswer) // Les questions ouvertes ont une évaluation spéciale
        : userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim(); // Comparaison simple pour QCM/vrai-faux
      return { questionId: q.id, userAnswer, isCorrect };
    });

    // On compte les bonnes réponses
    const score = answers.filter(a => a.isCorrect).length;

    const result: QuizResult = {
      quizId: quiz.id,
      quizTitle: quiz.title,
      answers,
      score,
      totalQuestions: quiz.questions.length,
      completedAt: new Date().toISOString()
    };

    // On sauvegarde le résultat localement
    this.currentResult.set(result);
    this.results.update(results => [...results, result]);

    // On envoie aussi le résultat au serveur
    this.http.post<QuizResult>('/api/results', {
      quizId: quiz.id,
      quizTitle: quiz.title,
      answers,
      score,
      totalQuestions: quiz.questions.length
    }).subscribe();
  }

  // Récupère tous les résultats pour un quiz donné
  getResultsForQuiz(quizId: string): QuizResult[] {
    return this.results().filter(r => r.quizId === quizId);
  }

  // Charge les quiz et résultats depuis le serveur
  private loadFromApi(): void {
    this.http.get<Quiz[]>('/api/quizzes').subscribe(quizzes => this.quizzes.set(quizzes));
    this.http.get<QuizResult[]>('/api/results').subscribe(results => this.results.set(results));
  }

  // Évalue une réponse ouverte en comparant les mots clés
  // Si au moins 50% des mots importants sont présents, c'est considéré correct
  private evaluateOpenAnswer(userAnswer: string, correctAnswer: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[.,;:!?]/g, '');
    const user = normalize(userAnswer);
    const correct = normalize(correctAnswer);
    if (!user) return false;
    const correctWords = correct.split(/\s+/).filter(w => w.length > 3); // On garde les mots de plus de 3 lettres
    if (correctWords.length === 0) return user === correct;
    const matchCount = correctWords.filter(w => user.includes(w)).length;
    return matchCount >= correctWords.length * 0.5; // Correct si au moins 50% des mots clés sont présents
  }
}
