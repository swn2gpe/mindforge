// Un noeud de la carte mentale (structure en arbre récursif)
export interface MindmapNode {
  id: string;                // Identifiant unique du noeud
  label: string;             // Texte affiché dans le noeud
  children: MindmapNode[];   // Sous-noeuds (branches enfants)
}

// Une carte mentale complète
export interface Mindmap {
  id: string;              // Identifiant unique
  title: string;           // Titre de la carte mentale
  folderId: string | null; // Dossier parent (null = pas rangé)
  root: MindmapNode;       // Noeud racine (contient tout l'arbre)
  createdAt: string;       // Date de création
}
