import { TestBed } from '@angular/core/testing';
import { AppTopbarComponent } from './app-topbar';
import { testProviders } from '../../test-providers';

describe('AppTopbarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTopbarComponent],
      providers: testProviders,
    }).compileComponents();
  });

  it('should create the topbar component', () => {
    const fixture = TestBed.createComponent(AppTopbarComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should list available themes', () => {
    const fixture = TestBed.createComponent(AppTopbarComponent);
    const component = fixture.componentInstance;
    // In Lean MVP mode, theme list is restricted to Light and Dark
    expect((component as any).themes.length).toBe(2);
  });
});
