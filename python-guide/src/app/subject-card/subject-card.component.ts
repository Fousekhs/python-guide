import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { PlayIconComponent } from '../../assets/icons/play.component';
import { NgClass, CommonModule } from '@angular/common';

export type SubjectStatus = 'first' | 'passed' | 'failed';

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

  @Input() status: SubjectStatus = 'first';
  @Input() available: boolean = false;
  @Input() destination: any = ['/'];

  constructor(private router: Router) {}

  /** Handler for play-button click */
  onPlay(): void {
    console.log('Play button clicked');
    this.router.navigate(this.destination);
  }
  
  /** Derive subtitle text */
  get subtitle(): string {
    switch (this.status) {
      case 'passed': return 'Passed';
      case 'failed': return 'Failed';
      default:       return 'Start';
    }
  }

  /** CSS class for subtitle based on status */
  get subtitleClass(): string {
    switch (this.status) {
      case 'passed': return 'subtitle--green';
      case 'failed': return 'subtitle--red';
      default:       return 'subtitle--grey';
    }
  }
}