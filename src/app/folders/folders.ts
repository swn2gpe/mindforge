import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FolderService } from '../services/folder.service';
import { FlashcardService } from '../services/flashcard.service';
import { MindmapService } from '../services/mindmap.service';
import { fadeInUp, staggerList, staggerItem } from '../shared/animations';

type SortOption = 'name-asc' | 'name-desc' | 'date-new' | 'date-old' | 'custom';

// Composant principal pour naviguer dans l'arborescence des dossiers
// Affiche les sous-dossiers, fiches et cartes mentales du dossier courant
@Component({
  selector: 'app-folders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, DragDropModule],
  templateUrl: './folders.html',
  styleUrl: './folders.scss',
  animations: [fadeInUp, staggerList, staggerItem]
})
export class FoldersComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly folderService = inject(FolderService);
  protected readonly flashcardService = inject(FlashcardService);
  protected readonly mindmapService = inject(MindmapService);

  // ID du dossier actuellement ouvert (null = racine)
  protected readonly currentFolderId = signal<string | null>(null);
  protected readonly sortOption = signal<SortOption>('name-asc'); // Default sort: Name A-Z

  // Affiche/masque le formulaire de création de dossier
  protected readonly showNewFolder = signal(false);
  protected readonly showNewItem = signal(false);

  // Ordre personnalisé (mémoire de session pour le drag & drop)
  protected readonly customFolderOrder = signal<Map<string, string[]>>(new Map());
  protected readonly customDeckOrder = signal<Map<string, string[]>>(new Map());
  protected readonly customMindmapOrder = signal<Map<string, string[]>>(new Map());

  // Champ de saisie pour le nom du nouveau dossier
  protected readonly folderName = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] });

  // Récupère les infos du dossier courant
  protected readonly currentFolder = computed(() => {
    const id = this.currentFolderId();
    return id ? this.folderService.getFolder(id) : undefined;
  });

  // Helper function to sort any list based on sortOption
  // Removed private sortList as logic is now inline or redundant, but keeping for reference if needed


  // Sous-dossiers triés
  protected readonly subFolders = computed(() => {
    let list = this.folderService.getChildren(this.currentFolderId());
    const option = this.sortOption();
    if (option === 'custom') {
      const parentId = this.currentFolderId() ?? 'root';
      const order = this.customFolderOrder().get(parentId);
      if (order) {
        return [...list].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }
      return list;
    }
    return [...list].sort((a, b) => {
        if (option === 'name-asc') return a.name.localeCompare(b.name);
        if (option === 'name-desc') return b.name.localeCompare(a.name);
        if (option === 'date-new') return new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime();
        if (option === 'date-old') return new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime();
        return 0;
    });
  });

  // Paquets de fiches triés
  protected readonly decksHere = computed(() => {
    let list = this.flashcardService.getDecksInFolder(this.currentFolderId());
    const option = this.sortOption();
    if (option === 'custom') {
      const parentId = this.currentFolderId() ?? 'root';
      const order = this.customDeckOrder().get(parentId);
      if (order) {
        return [...list].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }
      return list;
    }
    return [...list].sort((a, b) => {
        if (option === 'name-asc') return a.title.localeCompare(b.title);
        if (option === 'name-desc') return b.title.localeCompare(a.title);
        if (option === 'date-new') return new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime();
        if (option === 'date-old') return new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime();
        return 0;
    });
  });

  // Cartes mentales triées
  protected readonly mindmapsHere = computed(() => {
    let list = this.mindmapService.getMindmapsInFolder(this.currentFolderId());
    const option = this.sortOption();
    if (option === 'custom') {
      const parentId = this.currentFolderId() ?? 'root';
      const order = this.customMindmapOrder().get(parentId);
      if (order) {
        return [...list].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }
      return list;
    }
    return [...list].sort((a, b) => { 
        if (option === 'name-asc') return a.title.localeCompare(b.title);
        if (option === 'name-desc') return b.title.localeCompare(a.title);
        if (option === 'date-new') return new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime();
        if (option === 'date-old') return new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime();
        return 0;
    });
  });

  // Local mutable lists for Drag & Drop
  protected readonly localFolders = signal<import('../models/folder.model').Folder[]>([]);
  protected readonly localDecks = signal<import('../models/flashcard.model').FlashcardDeck[]>([]);
  protected readonly localMindmaps = signal<import('../models/mindmap.model').Mindmap[]>([]);

  // Fil d'Ariane : chemin depuis la racine jusqu'au dossier courant
  protected readonly breadcrumbs = computed(() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Mes dossiers' }];
    let current = this.currentFolderId();
    const visited = new Set<string>(); // Protection contre les boucles infinies
    while (current) {
      if (visited.has(current)) break;
      visited.add(current);
      const folder = this.folderService.getFolder(current);
      if (folder) {
        crumbs.push({ id: folder.id, name: folder.name });
        current = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  });

  constructor() {
    // When service data or sort option changes, update local lists
    effect(() => {
        // We use untracked for local setters if needed, but here we want to react to computed changes
        this.localFolders.set(this.subFolders());
        this.localDecks.set(this.decksHere());
        this.localMindmaps.set(this.mindmapsHere());
    }, { allowSignalWrites: true });

    // On écoute les changements d'URL
    this.route.paramMap.subscribe(params => {
      this.currentFolderId.set(params.get('folderId') ?? null);
    });
  }

  /* ------------------------------------------------------------------
     SORTING & DRAG AND DROP
  ------------------------------------------------------------------ */

  setSort(option: SortOption) {
    this.sortOption.set(option);
  }

  // Handle Drag & Drop
  drop(event: CdkDragDrop<any[]>, type: 'folder' | 'deck' | 'mindmap') {
    if (event.previousIndex === event.currentIndex) return;

    // Switch to custom sort mode implicitly 
    this.sortOption.set('custom');

    const parentId = this.currentFolderId() ?? 'root';

    if (type === 'folder') {
        const items = [...this.localFolders()];
        moveItemInArray(items, event.previousIndex, event.currentIndex);
        const order = items.map(i => i.id);
        
        this.customFolderOrder.update(map => {
            const newMap = new Map(map);
            newMap.set(parentId, order);
            return newMap;
        });
    } else if (type === 'deck') {
        const items = [...this.localDecks()];
        moveItemInArray(items, event.previousIndex, event.currentIndex);
        const order = items.map(i => i.id);
        
        this.customDeckOrder.update(map => {
            const newMap = new Map(map);
            newMap.set(parentId, order);
            return newMap;
        });
    } else if (type === 'mindmap') {
        const items = [...this.localMindmaps()];
        moveItemInArray(items, event.previousIndex, event.currentIndex);
        const order = items.map(i => i.id);
        
        this.customMindmapOrder.update(map => {
            const newMap = new Map(map);
            newMap.set(parentId, order);
            return newMap;
        });
    }
  }


  // Navigue vers un dossier (ou la racine si id est null)
  navigateToFolder(id: string | null): void {
    if (id) {
      this.router.navigate(['/folders', id]);
    } else {
      this.router.navigate(['/folders']);
    }
  }

  // Crée un nouveau sous-dossier dans le dossier courant
  createFolder(): void {
    const name = this.folderName.value.trim();
    if (!name) return;
    this.folderService.create(name, this.currentFolderId());
    this.folderName.reset();
    this.showNewFolder.set(false);
  }

  // Supprime un dossier (et ses sous-dossiers)
  deleteFolder(id: string): void {
    this.folderService.delete(id);
  }

  // Supprime un paquet de fiches
  deleteDeck(id: string): void {
    this.flashcardService.deleteDeck(id);
  }

  // Supprime une carte mentale
  deleteMindmap(id: string): void {
    this.mindmapService.deleteMindmap(id);
  }
}
