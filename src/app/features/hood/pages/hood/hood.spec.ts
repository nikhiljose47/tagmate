import { TestBed } from '@angular/core/testing';
import { HoodPage } from './hood';
import { testProviders } from '../../../../test-providers';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('HoodPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoodPage],
      providers: [
        ...testProviders,
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create the hood page component', () => {
    const fixture = TestBed.createComponent(HoodPage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should initialize with default states', () => {
    const fixture = TestBed.createComponent(HoodPage);
    const component = fixture.componentInstance;
    expect(component.isSearching()).toBeFalse();
    expect(component.showToolFab()).toBeFalse();
  });

  it('should toggle layers successfully', () => {
    const fixture = TestBed.createComponent(HoodPage);
    const component = fixture.componentInstance;
    
    const initialPostsVisible = component.postsVisible();
    component.togglePostsLayer();
    expect(component.postsVisible()).toBe(!initialPostsVisible);
  });
});
