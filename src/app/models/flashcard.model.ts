// Une fiche de révision avec un recto et un verso
export interface Flashcard {
  id: number;    // Numéro de la fiche
  front: string; // Texte du recto (la question)
  back: string;  // Texte du verso (la réponse)
}

// Un paquet de fiches de révision
export interface FlashcardDeck {
  id: string;              // Identifiant unique du paquet
  title: string;           // Titre du paquet
  folderId: string | null; // Dossier parent (null = pas rangé)
  cards: Flashcard[];      // Liste des fiches
  createdAt: string;       // Date de création
}
