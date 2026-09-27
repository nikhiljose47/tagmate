import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { testProviders } from './test-providers';
import { AppUpdateService } from './core/services/app-update.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: testProviders,
      teardown: { destroyAfterEach: false },
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-nav')?.textContent).toContain('Home');
  });

  it('shows the update notice when a new version is ready', () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(AppUpdateService).updateReady.set(true);

    fixture.detectChanges();

    const notice = fixture.nativeElement.querySelector('.app-update') as HTMLElement;
    expect(notice.textContent).toContain('New version available');
    expect(notice.querySelector('.app-update-action')?.textContent).toContain('Update');
  });
});
