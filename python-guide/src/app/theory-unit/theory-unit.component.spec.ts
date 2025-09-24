import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TheoryUnitComponent } from './theory-unit.component';

describe('TheoryUnitComponent', () => {
  let component: TheoryUnitComponent;
  let fixture: ComponentFixture<TheoryUnitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TheoryUnitComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TheoryUnitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
