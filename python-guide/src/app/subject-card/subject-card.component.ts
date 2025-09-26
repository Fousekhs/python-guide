import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { PlayIconComponent } from '../../assets/icons/play.component';
import { NgClass, CommonModule } from '@angular/common';

@Component({
  selector: 'app-subject-card',
  imports: [
    PlayIconComponent,
    NgClass,
    CommonModule
  ],
  templateUrl: './subject-card.component.html',
  styleUrls: ['./subject-card.component.css']
})
export class SubjectCardComponent {
  @Input() title!: string;
  @Input() available: boolean = false;
  @Input() destination: any = ['/'];
  // Points earned for this subject (best score)
  @Input() earnedPoints: number = 0;
  // Minimum required total user points to unlock
  @Input() requiredPoints: number = 0;
  // Total user points (for contextual display if needed later)
  @Input() userTotalPoints: number = 0;
  // Potential maximum points achievable in this subject (sum of maxPoints across contents)
  @Input() potentialMaxPoints: number = 0;

  constructor(private router: Router) {}

  onPlay(): void {
    if (this.available) {
      this.router.navigate(this.destination);
    }
  }

  get subtitle(): string {
    if (this.available) {
      if (this.potentialMaxPoints > 0) {
        return `${this.earnedPoints} / ${this.potentialMaxPoints} pts`;
      }
      return `${this.earnedPoints} pts earned`;
    }
    const needed = Math.max(0, this.requiredPoints - this.userTotalPoints);
    return `Locked · Need ${needed} pts`;
  }

  get subtitleClass(): string {
    return this.available ? 'subtitle--green' : 'subtitle--red';
  }

  get unlockProgressPercent(): number {
    if (this.available) return 100;
    if (!this.requiredPoints) return 0;
    const pct = (this.userTotalPoints / this.requiredPoints) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  get subjectCompletionPercent(): number {
    if (this.potentialMaxPoints <= 0) return 0;
    const pct = (this.earnedPoints / this.potentialMaxPoints) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
}