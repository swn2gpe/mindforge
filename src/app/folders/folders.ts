import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { FolderService } from '../services/folder.service';
import { FlashcardService } from '../services/flashcard.service';
import { MindmapService } from '../services/mindmap.service';
import { fadeInUp, staggerList, staggerItem } from '../shared/animations';

// Composant principal pour naviguer dans l'arborescence des dossiers
// Affiche les sous-dossiers, fiches et cartes mentales du dossier courant
@Component({
  selector: 'app-folders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
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
  // Affiche/masque le formulaire de création de dossier
  protected readonly showNewFolder = signal(false);
  protected readonly showNewItem = signal(false);

  // Champ de saisie pour le nom du nouveau dossier
  protected readonly folderName = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] });

  // Récupère les infos du dossier courant
  protected readonly currentFolder = computed(() => {
    const id = this.currentFolderId();
    return id ? this.folderService.getFolder(id) : undefined;
  });

  // Sous-dossiers du dossier courant
  protected readonly subFolders = computed(() =>
    this.folderService.getChildren(this.currentFolderId())
  );

  // Paquets de fiches dans le dossier courant
  protected readonly decksHere = computed(() =>
    this.flashcardService.getDecksInFolder(this.currentFolderId())
  );

  // Cartes mentales dans le dossier courant
  protected readonly mindmapsHere = computed(() =>
    this.mindmapService.getMindmapsInFolder(this.currentFolderId())
  );

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
    // On écoute les changements d'URL pour mettre à jour le dossier courant
    this.route.paramMap.subscribe(params => {
      this.currentFolderId.set(params.get('folderId') ?? null);
    });
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
