import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress-container"
      role="progressbar"
      [attr.aria-valuenow]="current()"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="total()"
      [attr.aria-label]="'Question ' + current() + ' sur ' + total()">
      <div class="progress-bar" [style.width.%]="percentage()"></div>
      <span class="progress-text">{{ current() }} / {{ total() }}</span>
    </div>
  `,
  styles: [`
    .progress-container {
      position: relative;
      height: 2.25rem;
      background: var(--hover);
      border-radius: 1rem;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 1rem;
      transition: width 0.4s ease;
    }
    .progress-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-primary);
    }
  `]
})
export class ProgressBarComponent {
  readonly current = input.required<number>();
  readonly total = input.required<number>();
  readonly percentage = computed(() =>
    this.total() > 0 ? (this.current() / this.total()) * 100 : 0
  );
}
