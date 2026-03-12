import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { AiConfig } from '../models/quiz.model';

// Page de paramètres : permet de configurer la clé API et le fournisseur d'IA
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private readonly aiService = inject(AiService);

  // Affiche un message de confirmation après sauvegarde
  protected readonly saved = signal(false);

  // Formulaire avec les 3 champs : fournisseur, clé API, modèle
  protected readonly form = new FormGroup({
    provider: new FormControl<AiConfig['provider']>('openai', { nonNullable: true }),
    apiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    model: new FormControl('gpt-4o-mini', { nonNullable: true, validators: [Validators.required] })
  });

  constructor() {
    // On charge la config déjà sauvegardée pour pré-remplir le formulaire
    const config = this.aiService.getConfig();
    this.form.patchValue(config);
  }

  // Sauvegarde la configuration et affiche un message de confirmation temporaire
  save(): void {
    if (this.form.invalid) return;
    this.aiService.saveConfig(this.form.getRawValue());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000); // Le message disparaît après 3 secondes
  }
}
