import { TestBed } from '@angular/core/testing';
import { DropdownComponent } from './dropdown.component';

describe('DropdownComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DropdownComponent] }).compileComponents();
  });

  it('opens in the top layer and allows an option to be selected', () => {
    const fixture = TestBed.createComponent(DropdownComponent);
    fixture.componentRef.setInput('options', [
      { label: 'First', value: 'first' },
      { label: 'Second', value: 'second' },
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.tm-dropdown-trigger')!.click();
    fixture.detectChanges();

    const panel = root.querySelector<HTMLDivElement>('.tm-dropdown-panel')!;
    expect(panel.matches(':popover-open')).toBeTrue();

    root.querySelectorAll<HTMLButtonElement>('.tm-dropdown-option')[1]!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('second');
    expect(panel.matches(':popover-open')).toBeFalse();
  });

  it('clamps a wide panel within the viewport', () => {
    const fixture = TestBed.createComponent(DropdownComponent);
    fixture.componentRef.setInput('options', [{ label: 'First', value: 'first' }]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.tm-dropdown-trigger')!;
    spyOn(trigger, 'getBoundingClientRect').and.returnValue(
      DOMRect.fromRect({ x: -40, y: 40, width: 500, height: 44 }),
    );
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(320);

    trigger.click();
    fixture.detectChanges();

    const panel = root.querySelector<HTMLDivElement>('.tm-dropdown-panel')!;
    expect(panel.style.left).toBe('8px');
    expect(panel.style.width).toBe('304px');
  });

  it('stays open while its option list is scrolled', () => {
    const fixture = TestBed.createComponent(DropdownComponent);
    fixture.componentRef.setInput(
      'options',
      Array.from({ length: 20 }, (_, index) => ({
        label: `Option ${index + 1}`,
        value: `${index + 1}`,
      })),
    );
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.tm-dropdown-trigger')!.click();
    fixture.detectChanges();

    const panel = root.querySelector<HTMLDivElement>('.tm-dropdown-panel')!;
    panel.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(panel.matches(':popover-open')).toBeTrue();
  });

  it('still closes when the surrounding page scrolls', () => {
    const fixture = TestBed.createComponent(DropdownComponent);
    fixture.componentRef.setInput('options', [{ label: 'First', value: 'first' }]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.tm-dropdown-trigger')!.click();
    fixture.detectChanges();

    const panel = root.querySelector<HTMLDivElement>('.tm-dropdown-panel')!;
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(panel.matches(':popover-open')).toBeFalse();
  });
});
