import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MindmapService } from '../../services/mindmap.service';
import { AiService } from '../../services/ai.service';
import { MindmapNode } from '../../models/mindmap.model';

// Composant pour créer ou modifier une carte mentale (structure en arbre)
@Component({
  selector: 'app-mindmap-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './mindmap-editor.html',
  styleUrl: './mindmap-editor.scss'
})
export class MindmapEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mindmapService = inject(MindmapService);
  private readonly http = inject(HttpClient);
  protected readonly aiService = inject(AiService);

  // Est-ce qu'on crée une nouvelle carte ou qu'on en modifie une existante ?
  protected readonly isNew: boolean;
  private readonly mindmapId: string | null;
  private readonly folderId: string | null; // Dossier dans lequel ranger la carte

  // Champ pour le titre de la carte mentale
  protected readonly titleControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  // Le noeud racine de l'arbre (contient tous les enfants)
  protected readonly root = signal<MindmapNode>(this.createNode('Sujet principal'));
  protected readonly saving = signal(false);
  // ID du noeud actuellement sélectionné (pour ajouter des enfants)
  protected readonly selectedNodeId = signal<string | null>(null);
  // Champ de saisie pour le nom d'un nouveau noeud enfant
  protected readonly newChildLabel = new FormControl('', { nonNullable: true });
  // Message d'erreur à afficher
  protected readonly error = signal('');
  // Indique si l'extraction du fichier est en cours
  protected readonly extracting = signal(false);
  // Indique si la génération IA de la carte est en cours
  protected readonly generating = signal(false);
  // Nom du fichier importé
  protected readonly importedFileName = signal('');

  constructor() {
    // On récupère l'ID de la carte et le dossier depuis l'URL
    this.mindmapId = this.route.snapshot.paramMap.get('id');
    this.isNew = !this.mindmapId; // Pas d'ID = création (route /mindmaps/new n'a pas de :id)
    this.folderId = this.route.snapshot.queryParamMap.get('folder');

    // Si on modifie une carte existante, on charge ses données
    if (!this.isNew && this.mindmapId) {
      const mm = this.mindmapService.getMindmap(this.mindmapId);
      if (mm) {
        this.titleControl.setValue(mm.title);
        this.root.set(mm.root);
      }
    }
  }

  // Sélectionne un noeud (ou le désélectionne si on clique dessus à nouveau)
  selectNode(id: string): void {
    this.selectedNodeId.set(this.selectedNodeId() === id ? null : id);
  }

  // Ajoute un noeud enfant au noeud parent sélectionné
  addChild(parentId: string): void {
    const label = this.newChildLabel.value.trim();
    if (!label) return;
    this.root.update(root => this.addChildToNode(root, parentId, label));
    this.newChildLabel.reset();
  }

  // Supprime un noeud de l'arbre (sauf la racine)
  removeNode(nodeId: string): void {
    if (nodeId === this.root().id) return; // On ne peut pas supprimer la racine
    this.root.update(root => this.removeFromTree(root, nodeId));
    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set(null);
    }
  }

  // Sauvegarde la carte mentale (création ou mise à jour)
  save(): void {
    if (this.titleControl.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const title = this.titleControl.value;

    if (this.isNew) {
      // Création : on envoie au serveur et on redirige vers la vue
      this.mindmapService.createMindmap(title, this.root(), this.folderId).subscribe({
        next: mm => {
          this.saving.set(false);
          this.router.navigate(['/mindmaps', mm.id]);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Erreur lors de la sauvegarde. Vérifiez que le serveur est lancé.');
        }
      });
    } else if (this.mindmapId) {
      // Modification : on met à jour la carte existante
      this.mindmapService.updateMindmap(this.mindmapId, { title, root: this.root() }).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/mindmaps', this.mindmapId]);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Erreur lors de la mise à jour.');
        }
      });
    }
  }

  // Import d'un fichier (.txt, .docx, .pptx, .pdf) → extraction du texte → génération de la carte par l'IA
  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const name = file.name.toLowerCase();
    this.error.set('');
    this.importedFileName.set(file.name);

    if (name.endsWith('.txt')) {
      // Fichier texte : lecture directe côté client
      const reader = new FileReader();
      reader.onload = () => this.generateFromText(reader.result as string);
      reader.readAsText(file);
    } else if (name.endsWith('.docx') || name.endsWith('.pptx') || name.endsWith('.pdf')) {
      // Fichier Word, PowerPoint ou PDF : envoi au serveur pour extraction
      this.extracting.set(true);
      const formData = new FormData();
      formData.append('file', file);

      this.http.post<{ text: string }>('/api/upload/extract-text', formData).subscribe({
        next: (res) => {
          this.extracting.set(false);
          this.generateFromText(res.text);
        },
        error: (err) => {
          this.extracting.set(false);
          this.importedFileName.set('');
          this.error.set(err.error?.error ?? 'Erreur lors de l\'extraction du texte.');
        }
      });
    } else {
      this.importedFileName.set('');
      this.error.set('Format non supporté. Utilisez .txt, .docx, .pptx ou .pdf');
    }
  }

  // Envoie le texte extrait à l'IA pour générer une carte mentale automatiquement
  private generateFromText(text: string): void {
    if (!text.trim()) {
      this.error.set('Aucun texte n\'a pu être extrait du fichier.');
      this.importedFileName.set('');
      return;
    }

    this.generating.set(true);
    this.aiService.generateMindmap(text).subscribe({
      next: (result) => {
        this.generating.set(false);
        // Remplit le titre si vide
        if (!this.titleControl.value) {
          this.titleControl.setValue(result.title);
        }
        // Remplace l'arbre par celui généré par l'IA
        this.root.set(result.root);
      },
      error: (err) => {
        this.generating.set(false);
        if (err.status === 401) {
          this.error.set('Clé API invalide. Vérifiez vos paramètres.');
        } else {
          this.error.set('Erreur lors de la génération de la carte mentale par l\'IA.');
        }
      }
    });
  }

  // Crée un nouveau noeud avec un ID unique
  private createNode(label: string): MindmapNode {
    return { id: crypto.randomUUID(), label, children: [] };
  }

  // Cherche le parent dans l'arbre et lui ajoute un enfant (récursif)
  private addChildToNode(node: MindmapNode, parentId: string, label: string): MindmapNode {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, this.createNode(label)] };
    }
    return { ...node, children: node.children.map(c => this.addChildToNode(c, parentId, label)) };
  }

  // Supprime un noeud de l'arbre en le filtrant (récursif)
  private removeFromTree(node: MindmapNode, targetId: string): MindmapNode {
    return {
      ...node,
      children: node.children
        .filter(c => c.id !== targetId)       // On enlève le noeud visé
        .map(c => this.removeFromTree(c, targetId)) // On continue dans les sous-arbres
    };
  }
}
