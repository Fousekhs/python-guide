import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonUnitComponent } from './lesson-unit.component';

describe('LessonUnitComponent', () => {
  let component: LessonUnitComponent;
  let fixture: ComponentFixture<LessonUnitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonUnitComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LessonUnitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
