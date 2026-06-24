import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagExplorer } from './tag-explorer';
import { testProviders } from '../../test-providers';

describe('TagExplorer', () => {
  let component: TagExplorer;
  let fixture: ComponentFixture<TagExplorer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagExplorer],
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagExplorer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
