import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserSessionService } from '../../../../core/services/user-session.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './not-found.html',
  styleUrls: ['./not-found.scss']
})
export class NotFoundPage {
  private readonly session = inject(UserSessionService);
  private readonly router = inject(Router);

  protected get isLoggedIn(): boolean {
    return this.session.user() !== null;
  }

  protected goBack(): void {
    if (this.isLoggedIn) {
      void this.router.navigate(['/feed']);
    } else {
      void this.router.navigate(['/login']);
    }
  }
}
