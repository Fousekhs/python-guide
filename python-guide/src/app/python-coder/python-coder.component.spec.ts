import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PythonCoderComponent } from './python-coder.component';

describe('PythonCoderComponent', () => {
  let component: PythonCoderComponent;
  let fixture: ComponentFixture<PythonCoderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PythonCoderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PythonCoderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
