import { trigger, transition, style, animate, query, stagger, group, animateChild } from '@angular/animations';

// ============================================================
// Animations réutilisables pour toute l'application
// ============================================================

// Animation de transition entre les pages (fondu + léger glissement vers le haut)
export const routeAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(12px)' })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('150ms ease-out', style({ opacity: 0 }))
      ], { optional: true }),
      query(':enter', [
        animate('250ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true })
  ])
]);

// Animation d'apparition en fondu avec glissement vers le haut
export const fadeInUp = trigger('fadeInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(20px)' }),
    animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);

// Animation d'apparition en fondu simple
export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('300ms ease-out', style({ opacity: 1 }))
  ])
]);

// Animation de mise à l'échelle depuis le centre (pour les cartes / badges)
export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ opacity: 1, transform: 'scale(1)' }))
  ])
]);

// Animation d'entrée avec glissement latéral (gauche → droite ou droite → gauche)
export const slideIn = trigger('slideIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-20px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
  ])
]);

// Animation d'entrée avec décalage (stagger) pour les listes d'éléments
// Utiliser sur le conteneur parent, chaque enfant doit avoir @staggerItem
export const staggerList = trigger('staggerList', [
  transition(':enter', [
    query('@staggerItem', stagger('60ms', animateChild()), { optional: true })
  ])
]);

// Animation individuelle pour chaque élément d'une liste staggerée
export const staggerItem = trigger('staggerItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(15px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);

// Animation de slide pour les transitions de questions (glissement horizontal)
export const slideQuestion = trigger('slideQuestion', [
  transition(':increment', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateX(50px)' })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(-50px)' }))
      ], { optional: true }),
      query(':enter', [
        animate('300ms 100ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ], { optional: true })
    ])
  ]),
  transition(':decrement', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateX(-50px)' })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(50px)' }))
      ], { optional: true }),
      query(':enter', [
        animate('300ms 100ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ], { optional: true })
    ])
  ])
]);

// Animation du cercle de score (grandit + rebond)
export const scorePop = trigger('scorePop', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0)' }),
    animate('600ms 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ opacity: 1, transform: 'scale(1)' }))
  ])
]);
