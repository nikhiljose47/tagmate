import { TestBed } from '@angular/core/testing';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  it('restores focus to the element that opened the dialog', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const service = TestBed.inject(ConfirmDialogService);

    const decision = service.confirm({ title: 'Delete', message: 'Are you sure?' });
    service.respond(false);
    await Promise.resolve();

    await expectAsync(decision).toBeResolvedTo(false);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
