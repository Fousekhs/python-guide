import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CapmaxProgressbarComponent } from './capmax-progressbar.component';

describe('CapmaxProgressbarComponent', () => {
  let component: CapmaxProgressbarComponent;
  let fixture: ComponentFixture<CapmaxProgressbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CapmaxProgressbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CapmaxProgressbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
