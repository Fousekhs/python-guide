import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-code-viewer',
  imports: [],
  templateUrl: './code-viewer.component.html',
  styleUrl: './code-viewer.component.css'
})
export class CodeViewerComponent {
  @Input() code: string = '';
}
