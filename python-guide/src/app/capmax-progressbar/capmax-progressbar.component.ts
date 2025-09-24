import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'capmax-progressbar',
  imports: [],
  templateUrl: './capmax-progressbar.component.html',
  styleUrl: './capmax-progressbar.component.css'
})
export class CapmaxProgressbarComponent implements OnChanges {
  @Input() current = 0;
  @Input() total = 100;

  percentage = 0;

  ngOnChanges() {
    this.percentage = this.total > 0
      ? Math.min(100, Math.max(0, (this.current / this.total) * 100))
      : 0;
  }

}
