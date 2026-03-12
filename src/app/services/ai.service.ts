import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AiConfig, GeneratedQuiz } from '../models/quiz.model';
import { Flashcard } from '../models/flashcard.model';
import { MindmapNode } from '../models/mindmap.model';

// Prompt système envoyé à l'IA pour générer le quiz
// On lui explique exactement le format JSON à retourner
const SYSTEM_PROMPT = `Tu es un générateur de quiz éducatif. À partir du texte fourni, crée un quiz complet pour aider à la révision.

Génère exactement :
- 5 questions à choix multiples (QCM) avec 4 options chacune
- 3 questions vrai/faux
- 2 questions ouvertes

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "title": "Titre du quiz basé sur le contenu",
  "questions": [
    {
      "type": "mcq",
      "question": "La question ?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explication de la bonne réponse"
    },
    {
      "type": "true-false",
      "question": "Affirmation à évaluer",
      "options": ["Vrai", "Faux"],
      "correctAnswer": "Vrai",
      "explanation": "Explication"
    },
    {
      "type": "open",
      "question": "Question ouverte ?",
      "correctAnswer": "Réponse attendue",
      "explanation": "Explication détaillée"
    }
  ]
}

IMPORTANT : Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

// Service pour communiquer avec l'API d'intelligence artificielle (OpenAI ou Mistral)
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly STORAGE_KEY = 'quiz-ai-config'; // Clé pour sauvegarder la config IA dans le navigateur

  // Récupère la configuration actuelle (clé API, fournisseur, modèle)
  getConfig(): AiConfig {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AiConfig;
    }
    // Valeurs par défaut si aucune config n'est sauvegardée
    return { apiKey: '', provider: 'openai', model: 'gpt-4o-mini' };
  }

  // Sauvegarde la configuration dans le navigateur
  saveConfig(config: AiConfig): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  }

  // Vérifie si une clé API a été configurée
  isConfigured(): boolean {
    return this.getConfig().apiKey.length > 0;
  }

  // Envoie le texte à l'IA et récupère un quiz généré
  generateQuiz(text: string): Observable<GeneratedQuiz> {
    const config = this.getConfig();

    // On choisit l'URL selon le fournisseur (OpenAI ou Mistral)
    const endpoint = config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.mistral.ai/v1/chat/completions';

    // Appel à l'API avec le prompt système et le texte de l'utilisateur
    return this.http.post<{ choices: { message: { content: string } }[] }>(endpoint, {
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Voici le texte à partir duquel générer le quiz :\n\n${text}` }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      // On extrait le JSON de la réponse de l'IA
      map(response => {
        const content = response.choices[0].message.content;
        return JSON.parse(content) as GeneratedQuiz;
      })
    );
  }

  // Prompt pour générer des fiches de révision à partir d'un texte
  private readonly FLASHCARD_PROMPT = `Tu es un créateur de fiches de révision. À partir du texte fourni, crée des fiches recto/verso pour aider à la mémorisation.

Génère entre 8 et 15 fiches selon la quantité de contenu.
Chaque fiche doit avoir :
- "front" : une question courte ou un concept clé
- "back" : la réponse ou la définition

Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "title": "Titre du paquet basé sur le contenu",
  "cards": [
    { "front": "Qu'est-ce que X ?", "back": "X est..." },
    { "front": "Définition de Y", "back": "Y signifie..." }
  ]
}

IMPORTANT : Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

  // Prompt pour générer une carte mentale (arborescence) à partir d'un texte
  private readonly MINDMAP_PROMPT = `Tu es un créateur de cartes mentales. À partir du texte fourni, crée une arborescence hiérarchique pour organiser les concepts clés.

Génère une structure avec :
- Un noeud racine qui résume le sujet principal
- 3 à 6 branches principales (sous-thèmes)
- Chaque branche peut avoir 1 à 4 sous-éléments

Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "title": "Titre de la carte mentale",
  "root": {
    "label": "Sujet principal",
    "children": [
      {
        "label": "Sous-thème 1",
        "children": [
          { "label": "Détail A", "children": [] },
          { "label": "Détail B", "children": [] }
        ]
      },
      {
        "label": "Sous-thème 2",
        "children": [
          { "label": "Détail C", "children": [] }
        ]
      }
    ]
  }
}

IMPORTANT : Retourne UNIQUEMENT le JSON, sans texte avant ou après. Chaque noeud DOIT avoir "label" (string) et "children" (array).`;

  // Envoie le texte à l'IA et récupère des fiches de révision générées
  generateFlashcards(text: string): Observable<{ title: string; cards: Flashcard[] }> {
    const config = this.getConfig();

    const endpoint = config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.mistral.ai/v1/chat/completions';

    return this.http.post<{ choices: { message: { content: string } }[] }>(endpoint, {
      model: config.model,
      messages: [
        { role: 'system', content: this.FLASHCARD_PROMPT },
        { role: 'user', content: `Voici le texte à partir duquel générer les fiches :\n\n${text}` }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      map(response => {
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content) as { title: string; cards: { front: string; back: string }[] };
        // On ajoute un ID à chaque fiche
        return {
          title: parsed.title,
          cards: parsed.cards.map((c, i) => ({ id: i + 1, front: c.front, back: c.back }))
        };
      })
    );
  }

  // Envoie le texte à l'IA et récupère une carte mentale générée
  generateMindmap(text: string): Observable<{ title: string; root: MindmapNode }> {
    const config = this.getConfig();

    const endpoint = config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.mistral.ai/v1/chat/completions';

    return this.http.post<{ choices: { message: { content: string } }[] }>(endpoint, {
      model: config.model,
      messages: [
        { role: 'system', content: this.MINDMAP_PROMPT },
        { role: 'user', content: `Voici le texte à partir duquel générer la carte mentale :\n\n${text}` }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      map(response => {
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content) as { title: string; root: { label: string; children: unknown[] } };
        // On ajoute un ID unique à chaque noeud de l'arbre
        return {
          title: parsed.title,
          root: this.assignNodeIds(parsed.root)
        };
      })
    );
  }

  // Ajoute récursivement un ID unique à chaque noeud de la carte mentale
  private assignNodeIds(node: { label: string; children?: unknown[] }): MindmapNode {
    return {
      id: crypto.randomUUID(),
      label: node.label,
      children: (node.children || []).map(c => this.assignNodeIds(c as { label: string; children?: unknown[] }))
    };
  }
}
