import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginPage } from './login';
import { testProviders } from '../../../../test-providers';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { UserModel } from '../../../../core/models/user.model';
import { of } from 'rxjs';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let sessionSpy: jasmine.SpyObj<UserSessionService>;

  beforeEach(async () => {
    sessionSpy = jasmine.createSpyObj<UserSessionService>(
      'UserSessionService',
      ['login', 'loginGuest', 'resendConfirmationEmail'],
      {
        user$: of({ isGuest: true, username: 'guest', email: null } as UserModel),
      },
    );

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [...testProviders, { provide: UserSessionService, useValue: sessionSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Password visibility and accessibility', () => {
    it('initializes with password hidden and correct ARIA attributes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const input = compiled.querySelector<HTMLInputElement>('#password');
      const toggleBtn = compiled.querySelector<HTMLButtonElement>('.password-toggle');

      expect(input).toBeTruthy();
      expect(input?.type).toBe('password');
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn?.getAttribute('aria-label')).toBe('Show password');
      expect(toggleBtn?.getAttribute('aria-pressed')).toBe('false');
      expect(toggleBtn?.getAttribute('tabindex')).toBeNull();
    });

    it('toggles password visibility and updates ARIA attributes on click', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const input = compiled.querySelector<HTMLInputElement>('#password');
      const toggleBtn = compiled.querySelector<HTMLButtonElement>('.password-toggle');

      toggleBtn?.click();
      fixture.detectChanges();

      expect(component.showPassword()).toBeTrue();
      expect(input?.type).toBe('text');
      expect(toggleBtn?.getAttribute('aria-label')).toBe('Hide password');
      expect(toggleBtn?.getAttribute('aria-pressed')).toBe('true');

      toggleBtn?.click();
      fixture.detectChanges();

      expect(component.showPassword()).toBeFalse();
      expect(input?.type).toBe('password');
      expect(toggleBtn?.getAttribute('aria-label')).toBe('Show password');
      expect(toggleBtn?.getAttribute('aria-pressed')).toBe('false');
    });

    it('ensures password toggle button is sequentially focusable', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggleBtn = compiled.querySelector<HTMLButtonElement>('.password-toggle');

      expect(toggleBtn?.tabIndex).toBe(0);
      expect(toggleBtn?.hasAttribute('disabled')).toBeFalse();
      expect(toggleBtn?.getAttribute('aria-hidden')).toBeNull();
    });
  });

  describe('Form validation', () => {
    it('shows error when both email and password are empty', async () => {
      component.email.set('');
      component.password.set('');
      await component.login();

      expect(component.error()).toBe('Please enter your email address/username and password to log in.');
      expect(sessionSpy.login).not.toHaveBeenCalled();
    });

    it('shows error when password is empty but email is provided', async () => {
      component.email.set('user@example.com');
      component.password.set('');
      await component.login();

      expect(component.error()).toBe('Please enter your password to log in.');
      expect(sessionSpy.login).not.toHaveBeenCalled();
    });

    it('shows error when email is empty but password is provided', async () => {
      component.email.set('');
      component.password.set('secret');
      await component.login();

      expect(component.error()).toBe('Please enter your email address or username to log in.');
      expect(sessionSpy.login).not.toHaveBeenCalled();
    });
  });
});
