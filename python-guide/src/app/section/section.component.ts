import { Component, HostBinding, Input, Output, EventEmitter } from '@angular/core';

import { RightChevronComponent } from '../../assets/icons/chevron-right.component';

@Component({
  selector: 'app-section',
  imports: [RightChevronComponent],
  templateUrl: './section.component.html',
  styleUrls: ['./section.component.css']
})
export class SectionComponent {
  @Input() title: string = '';
  @Input() first!: boolean;
  @Input() last!: boolean;

  private _hidden = true;

  @Output() didToogle = new EventEmitter<void>();

  
  get hidden(): boolean {
    return this._hidden;
  }
  
  toggle(shouldEmit: boolean = false): void {
    console.log('toggle ' + this.title);

    this._hidden = !this._hidden;

    if (shouldEmit) this.didToogle.emit();
  }

  react() {
    if (!this._hidden)this.toggle();
    console.log('react ' + this.title);
  }
}
