import { TestBed } from '@angular/core/testing';
import { NavComponent } from './nav';
import { testProviders } from '../../test-providers';

describe('NavComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: testProviders,
    }).compileComponents();
  });

  it('should create the nav component', () => {
    const fixture = TestBed.createComponent(NavComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should define the correct list of nav items', () => {
    const fixture = TestBed.createComponent(NavComponent);
    const component = fixture.componentInstance;
    expect(component.navItems.length).toBeGreaterThan(0);
    expect(component.navItems[0].label).toBe('Feed');
    expect(component.navItems[1].label).toBe('Map');
  });

  it('should render nav links in template', () => {
    const fixture = TestBed.createComponent(NavComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.nav-item');
    expect(items.length).toBeGreaterThan(0);
  });
});
