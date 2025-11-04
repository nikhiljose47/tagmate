import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tagmate } from './tagmate';

describe('Tagmate', () => {
  let component: Tagmate;
  let fixture: ComponentFixture<Tagmate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tagmate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tagmate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
