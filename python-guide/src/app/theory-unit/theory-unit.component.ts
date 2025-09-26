import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-theory-unit',
  imports: [],
  templateUrl: './theory-unit.component.html',
  styleUrl: './theory-unit.component.css'
})
export class TheoryUnitComponent {
  @Input() title: string = '';
  @Input() content: string = '';
  @Input() imgSrc: string = '';
  @Output() nextContent = new EventEmitter<void>();

  goToNext() {
    this.nextContent.emit();
  }
}
