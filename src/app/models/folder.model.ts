// Types d'éléments que l'on peut ranger dans un dossier
export type FolderItemType = 'flashcard-deck' | 'mindmap';

// Représente un dossier de classement
export interface Folder {
  id: string;              // Identifiant unique du dossier
  name: string;            // Nom affiché
  parentId: string | null; // Dossier parent (null = racine)
  color: string;           // Couleur du dossier
  createdAt: string;       // Date de création
}

// Représente un élément (fiche ou carte mentale) dans un dossier
export interface FolderItem {
  id: string;
  type: FolderItemType;    // Type : paquet de fiches ou carte mentale
  name: string;
  folderId: string | null; // Dossier dans lequel il se trouve
}
