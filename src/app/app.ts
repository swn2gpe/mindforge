import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header';
import { routeAnimation } from './shared/animations';

// Composant racine de l'application
// Affiche le header en haut et le contenu de la page en dessous
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [routeAnimation]
})
export class App {}
 