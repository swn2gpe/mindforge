// Les 3 types de questions possibles : QCM, vrai/faux, ouverte
export type QuestionType = 'mcq' | 'true-false' | 'open';

// Une question de quiz
export interface QuizQuestion {
  id: number;              // Numéro de la question
  type: QuestionType;      // Type de question
  question: string;        // Texte de la question
  options?: string[];      // Choix possibles (pour QCM et vrai/faux)
  correctAnswer: string;   // La bonne réponse
  explanation?: string;    // Explication de la réponse
}

// Un quiz complet avec ses questions
export interface Quiz {
  id: string;
  title: string;                // Titre du quiz
  sourceText: string;           // Texte source à partir duquel le quiz a été généré
  questions: QuizQuestion[];    // Liste des questions
  createdAt: string;            // Date de création
}

// La réponse d'un utilisateur à une question
export interface QuizAnswer {
  questionId: number;    // Numéro de la question
  userAnswer: string;    // Ce que l'utilisateur a répondu
  isCorrect: boolean;    // Est-ce que c'est correct ?
}

// Le résultat d'un quiz terminé
export interface QuizResult {
  quizId: string;           // ID du quiz correspondant
  quizTitle: string;        // Titre du quiz
  answers: QuizAnswer[];    // Toutes les réponses
  score: number;            // Nombre de bonnes réponses
  totalQuestions: number;   // Nombre total de questions
  completedAt: string;      // Date de fin
}

// Configuration de l'API d'intelligence artificielle
export interface AiConfig {
  apiKey: string;                    // Clé API
  provider: 'openai' | 'mistral';   // Fournisseur d'IA choisi
  model: string;                     // Modèle utilisé (ex: gpt-4o-mini)
}

// Format du quiz généré par l'IA (sans les id de questions)
export interface GeneratedQuiz {
  title: string;
  questions: Omit<QuizQuestion, 'id'>[];
}
