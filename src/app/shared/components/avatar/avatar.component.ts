import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { avatarBg, avatarInitials } from '../../utils/color.utils';

@Component({
  selector: 'tm-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tm-avatar"
      [style.background]="bg"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="size * 0.36"
      [attr.aria-label]="username + ' avatar'"
      role="img"
    >
      {{ initials }}
    </div>
  `,
  styles: [
    `
      .tm-avatar {
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: #fff;
        font-weight: 700;
        flex-shrink: 0;
        user-select: none;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class AvatarComponent {
  @Input({ required: true }) username!: string;
  @Input() size = 40;

  get bg(): string {
    return avatarBg(this.username);
  }
  get initials(): string {
    return avatarInitials(this.username);
  }
}
