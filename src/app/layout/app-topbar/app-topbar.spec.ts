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
    expect((component as unknown as { themes: { length: number } }).themes.length).toBe(2);
  });

  it('renders a compact place code and reveals the full place name on tap', () => {
    const fixture = TestBed.createComponent(AppTopbarComponent);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.hood-indicator') as HTMLButtonElement;
    expect(indicator.querySelector('.hood-indicator-label--code')?.textContent?.trim()).toBe('KA');

    indicator.click();
    fixture.detectChanges();

    const info = fixture.nativeElement.querySelector('.hood-indicator-info') as HTMLElement;
    expect(info.textContent).toContain('Karnataka');
  });
});
