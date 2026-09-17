import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignupPage } from './signup';
import { testProviders } from '../../../../test-providers';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { of } from 'rxjs';

describe('SignupPage (Auth & Signup Specialist Tests)', () => {
  let component: SignupPage;
  let fixture: ComponentFixture<SignupPage>;
  let sessionSpy: jasmine.SpyObj<UserSessionService>;

  beforeEach(async () => {
    sessionSpy = jasmine.createSpyObj<UserSessionService>(
      'UserSessionService',
      [
        'signup',
        'resendConfirmationEmail',
        'confirmSignupOtp',
        'isUsernameTaken',
        'generateBusinessWebsite',
        'updateBusinessImages',
        'updateAvatarUrl',
      ],
      {
        user$: of({ isGuest: true } as any),
      },
    );

    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        ...testProviders,
        { provide: UserSessionService, useValue: sessionSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Bug #5: Dynamic Days Calculation & Validation', () => {
    it('defaults to 31 days when month is not selected', () => {
      component.birthMonth.set('');
      expect(component.days().length).toBe(31);
    });

    it('calculates 30 days for 30-day months (Apr, Jun, Sep, Nov)', () => {
      for (const m of [4, 6, 9, 11]) {
        component.birthMonth.set(String(m));
        expect(component.days().length).toBe(30);
      }
    });

    it('calculates 31 days for 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)', () => {
      for (const m of [1, 3, 5, 7, 8, 10, 12]) {
        component.birthMonth.set(String(m));
        expect(component.days().length).toBe(31);
      }
    });

    it('calculates 28 days for February in a non-leap year or when year is not selected', () => {
      component.birthMonth.set('2');
      component.birthYear.set('');
      expect(component.days().length).toBe(28);

      component.birthYear.set('2023');
      expect(component.days().length).toBe(28);

      component.birthYear.set('1900'); // Century year not divisible by 400
      expect(component.days().length).toBe(28);
    });

    it('calculates 29 days for February in a leap year', () => {
      component.birthMonth.set('2');

      component.birthYear.set('2024');
      expect(component.days().length).toBe(29);

      component.birthYear.set('2000'); // Century year divisible by 400
      expect(component.days().length).toBe(29);
    });

    it('resets birthDay if selected day exceeds max days of the month', () => {
      component.birthMonth.set('1'); // January has 31
      component.birthDay.set('31');
      fixture.detectChanges();
      expect(component.birthDay()).toBe('31');

      // Change to February non-leap (max 28)
      component.birthMonth.set('2');
      component.birthYear.set('2023');
      fixture.detectChanges();
      expect(component.birthDay()).toBe('');
    });

    it('strictly validates calendar date accuracy in isOldEnough()', () => {
      // 31 February 2000 does not exist
      component.birthMonth.set('2');
      component.birthDay.set('31');
      component.birthYear.set('2000');
      expect(component.isOldEnough()).toBeFalse();
      expect(component.error()).toBe('Please enter a valid calendar date.');

      // 29 February 2023 (not leap)
      component.birthMonth.set('2');
      component.birthDay.set('29');
      component.birthYear.set('2023');
      expect(component.isOldEnough()).toBeFalse();
      expect(component.error()).toBe('Please enter a valid calendar date.');

      // 31 April 2000 does not exist
      component.birthMonth.set('4');
      component.birthDay.set('31');
      component.birthYear.set('2000');
      expect(component.isOldEnough()).toBeFalse();
      expect(component.error()).toBe('Please enter a valid calendar date.');
    });

    it('validates minimum age in isOldEnough()', () => {
      const thisYear = new Date().getFullYear();
      // 5 years old
      component.birthMonth.set('1');
      component.birthDay.set('1');
      component.birthYear.set(String(thisYear - 5));
      expect(component.isOldEnough()).toBeFalse();
      expect(component.error()).toBe('You must be at least 13 years old to sign up.');

      // 20 years old
      component.birthMonth.set('1');
      component.birthDay.set('1');
      component.birthYear.set(String(thisYear - 20));
      expect(component.isOldEnough()).toBeTrue();
    });
  });

  describe('Bug #7: Date of birth preserves selection', () => {
    it('retains birthMonth, birthDay, and birthYear when toggling steps', () => {
      component.accountType.set('personal');
      component.email.set('test@example.com');
      component.password.set('Secret123');
      component.fullName.set('Test User');
      component.username.set('testuser');

      component.step.set(5);
      component.birthMonth.set('6');
      component.birthDay.set('15');
      component.birthYear.set('1998');
      fixture.detectChanges();

      // Go back to Step 1
      component.prevStep();
      expect(component.step()).toBe(1);
      fixture.detectChanges();

      // Return to Step 5
      component.nextStep();
      expect(component.step()).toBe(5);
      fixture.detectChanges();

      // Selected signals remain preserved
      expect(component.birthMonth()).toBe('6');
      expect(component.birthDay()).toBe('15');
      expect(component.birthYear()).toBe('1998');

      // Verify DOM select elements have the values
      const compiled = fixture.nativeElement as HTMLElement;
      const selects = compiled.querySelectorAll('.birthday-row select') as NodeListOf<HTMLSelectElement>;
      expect(selects.length).toBe(3);
      expect(selects[0]!.value).toBe('6');
      expect(selects[1]!.value).toBe('15');
      expect(selects[2]!.value).toBe('1998');
    });
  });

  describe('Bug #6 & Rate Limit handling (Bug #1 & #2)', () => {
    it('renders the confirm-email-subtip when awaitingEmailConfirmation is true', () => {
      component.awaitingEmailConfirmation.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const subtip = compiled.querySelector('.confirm-email-subtip');
      expect(subtip).toBeTruthy();
      expect(subtip?.textContent).toContain(
        'If your confirmation email contains a link instead of a 6-digit code, you can click the link in your email to confirm your account.',
      );
      expect(subtip?.querySelector('i.bi-info-circle')).toBeTruthy();
    });

    it('displays friendly message when signup encounters a rate limit error', async () => {
      component.accountType.set('personal');
      component.birthMonth.set('1');
      component.birthDay.set('1');
      component.birthYear.set('2000');
      component.hoodPick.set({
        state: 'CA',
        country: 'USA',
        district: 'LA',
        place: 'Downtown',
        lat: 34.05,
        lng: -118.25,
      });

      sessionSpy.signup.and.returnValue(
        Promise.resolve({
          ok: false,
          code: 'rate_limit',
          message: 'over_email_send_rate_limit: email rate limit exceeded',
        } as any),
      );

      await component.signup();

      expect(component.error()).toBe(
        'Too many email requests sent recently. Please wait a few minutes before trying again or check your inbox/spam folder.',
      );
    });

    it('displays friendly message when resendConfirmationEmail throws or returns a rate limit error', async () => {
      component.email.set('test@example.com');
      sessionSpy.resendConfirmationEmail.and.rejectWith(
        new Error('email rate limit exceeded'),
      );

      await component.resendConfirmationEmail();

      expect(component.resendError()).toBe(
        'Too many email requests sent recently. Please wait a few minutes before trying again or check your inbox/spam folder.',
      );
    });
  });
});
