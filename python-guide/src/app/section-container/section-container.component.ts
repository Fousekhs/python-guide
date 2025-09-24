import { Component, ContentChildren, QueryList, AfterViewInit, OnDestroy } from '@angular/core';
import { SectionComponent } from '../section/section.component';
import { Subscription } from 'rxjs';
import { merge } from 'rxjs';
import { mapTo } from 'rxjs/operators';

@Component({
  selector: 'app-section-container',
  imports: [],
  templateUrl: './section-container.component.html',
  styleUrl: './section-container.component.css'
})
export class SectionContainerComponent implements AfterViewInit {
  @ContentChildren(SectionComponent) 
  children!: QueryList<SectionComponent>;
  
  private sub = null as any;

  ngAfterViewInit(): void {

    const streams = this.children.map(child =>
      child.didToogle.pipe(mapTo(child))
    );

    // merge them into one stream, subscribe once
    this.sub = merge(...streams)
      .subscribe((triggeringChild: SectionComponent) => {
        // for every other child, call react()
        this.children
          .filter(c => c !== triggeringChild)
          .forEach(c => c.react());
      });

    this.children.forEach((child, index) => {
      child.first = index === 0;
      child.last = index === this.children.length - 1;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
