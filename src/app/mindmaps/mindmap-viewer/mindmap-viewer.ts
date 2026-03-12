import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { MindmapService } from '../../services/mindmap.service';
import { Mindmap } from '../../models/mindmap.model';

// Composant pour afficher une carte mentale en lecture seule (vue hiérarchique)
@Component({
  selector: 'app-mindmap-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './mindmap-viewer.html',
  styleUrl: './mindmap-viewer.scss'
})
export class MindmapViewerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mindmapService = inject(MindmapService);

  // La carte mentale actuellement affichée
  protected readonly mindmap = signal<Mindmap | undefined>(undefined);

  constructor() {
    // On charge la carte depuis l'ID dans l'URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      const mm = this.mindmapService.getMindmap(id);
      if (mm) {
        this.mindmap.set(mm);
      } else {
        // Si la carte n'existe pas, retour aux dossiers
        this.router.navigate(['/folders']);
      }
    }
  }
}
