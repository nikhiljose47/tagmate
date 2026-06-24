import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tagmate } from './tagmate';
import { testProviders } from '../../test-providers';

describe('Tagmate', () => {
  let component: Tagmate;
  let fixture: ComponentFixture<Tagmate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tagmate],
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tagmate);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
