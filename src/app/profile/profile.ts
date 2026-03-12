import { Component, ChangeDetectionStrategy, inject, signal, OnInit, ElementRef, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { firstValueFrom } from 'rxjs';
import { fadeInUp, scaleIn, staggerList, staggerItem } from '../shared/animations';

// Statistiques de l'utilisateur renvoyées par le serveur
interface UserStats {
  quizCount: number;
  resultCount: number;
  deckCount: number;
  mindmapCount: number;
  folderCount: number;
}

// Page de profil : affiche les infos de l'utilisateur et permet de les modifier
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  animations: [fadeInUp, scaleIn, staggerList, staggerItem]
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);

  // Référence vers l'input fichier caché pour l'upload d'avatar
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // Messages de confirmation / erreur
  protected readonly profileSaved = signal(false);
  protected readonly profileError = signal('');
  protected readonly passwordChanged = signal(false);
  protected readonly passwordError = signal('');
  protected readonly avatarUploading = signal(false);
  protected readonly stats = signal<UserStats | null>(null);

  // Formulaire de modification du profil (nom et email)
  protected readonly profileForm = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] })
  });

  // Formulaire de changement de mot de passe
  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  ngOnInit(): void {
    // Pré-remplir le formulaire avec les données actuelles de l'utilisateur
    const user = this.auth.currentUser();
    if (user) {
      this.profileForm.patchValue({ displayName: user.displayName, email: user.email });
    }
    // Charger les statistiques
    this.loadStats();
  }

  // Calcule les initiales du nom (ex: "Jean Dupont" → "JD")
  protected initials(): string {
    const name = this.auth.currentUser()?.displayName ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  // Ouvre la boîte de dialogue de sélection de fichier pour changer l'avatar
  protected triggerAvatarUpload(): void {
    this.fileInput()?.nativeElement.click();
  }

  // Upload la photo de profil sélectionnée
  protected async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.avatarUploading.set(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const user = await firstValueFrom(this.http.post<User>('/api/auth/avatar', formData));
      this.auth.currentUser.set(user);
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? 'Erreur lors de l\'upload de la photo.';
      this.profileError.set(message);
      setTimeout(() => this.profileError.set(''), 3000);
    } finally {
      this.avatarUploading.set(false);
      input.value = ''; // Réinitialiser pour permettre de re-sélectionner le même fichier
    }
  }

  // Supprime la photo de profil
  protected async removeAvatar(): Promise<void> {
    this.avatarUploading.set(true);
    try {
      const user = await firstValueFrom(this.http.delete<User>('/api/auth/avatar'));
      this.auth.currentUser.set(user);
    } catch {
      this.profileError.set('Erreur lors de la suppression de la photo.');
      setTimeout(() => this.profileError.set(''), 3000);
    } finally {
      this.avatarUploading.set(false);
    }
  }

  // Formate la date de création du compte en français
  protected memberSince(): string {
    const date = this.auth.currentUser()?.createdAt;
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Charge les statistiques de l'utilisateur depuis le serveur
  private async loadStats(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<UserStats>('/api/auth/stats'));
      this.stats.set(data);
    } catch {
      // Pas critique, on laisse les stats vides
    }
  }

  // Sauvegarde les modifications du profil (nom, email)
  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;

    this.profileError.set('');
    this.profileSaved.set(false);

    try {
      const user = await firstValueFrom(
        this.http.put<User>('/api/auth/profile', this.profileForm.getRawValue())
      );
      // Met à jour l'utilisateur dans le service d'authentification
      this.auth.currentUser.set(user);
      this.profileSaved.set(true);
      setTimeout(() => this.profileSaved.set(false), 3000);
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? 'Erreur lors de la mise à jour.';
      this.profileError.set(message);
    }
  }

  // Change le mot de passe de l'utilisateur
  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();

    // Vérifier que les deux mots de passe correspondent
    if (newPassword !== confirmPassword) {
      this.passwordError.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.passwordError.set('');
    this.passwordChanged.set(false);

    try {
      await firstValueFrom(
        this.http.put<{ message: string }>('/api/auth/password', { currentPassword, newPassword })
      );
      this.passwordChanged.set(true);
      this.passwordForm.reset();
      setTimeout(() => this.passwordChanged.set(false), 3000);
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? 'Erreur lors du changement de mot de passe.';
      this.passwordError.set(message);
    }
  }
}
