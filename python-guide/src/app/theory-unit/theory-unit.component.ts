import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeParserPipe } from '../../pipes/CodeParserPipe.pipe';
import { CustomImagePipe } from '../../pipes/CustomImagePipe.pipe';
import { CodeViewerComponent } from '../code-viewer/code-viewer.component';

@Component({
  selector: 'app-theory-unit',
  imports: [CommonModule, CodeParserPipe, CustomImagePipe, CodeViewerComponent],
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
