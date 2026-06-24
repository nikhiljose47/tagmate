import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagForm } from './tag-form';
import { testProviders } from '../../test-providers';

describe('TagForm', () => {
  let component: TagForm;
  let fixture: ComponentFixture<TagForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagForm],
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
