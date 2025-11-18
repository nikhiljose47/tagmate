import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomPopup } from './custom-popup';

describe('CustomPopup', () => {
  let component: CustomPopup;
  let fixture: ComponentFixture<CustomPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomPopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomPopup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
