import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContentAdminPanelComponent } from './content-admin-panel.component';

describe('ContentAdminPanelComponent', () => {
  let component: ContentAdminPanelComponent;
  let fixture: ComponentFixture<ContentAdminPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentAdminPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContentAdminPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
