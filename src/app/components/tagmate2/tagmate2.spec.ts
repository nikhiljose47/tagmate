import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tagmate2 } from './tagmate2';

describe('Tagmate2', () => {
  let component: Tagmate2;
  let fixture: ComponentFixture<Tagmate2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tagmate2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tagmate2);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
