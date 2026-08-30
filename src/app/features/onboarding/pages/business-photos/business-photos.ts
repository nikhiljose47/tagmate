import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { MediaService } from '../../../../core/services/media.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { ToastService } from '../../../../core/services/toast.service';

const MAX_SHOP_IMAGES = 5;

/**
 * Mandatory catch-up screen for business accounts that reached signup with
 * email confirmation required — the shop photos/logo they picked at signup
 * only exist in that page's memory, so once they leave to check their inbox
 * those files are gone. This is where they add them for the first time,
 * post-confirmation. Gated by `businessPhotosGuard` on the other app routes.
 */
@Component({
  selector: 'app-business-photos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './business-photos.html',
  styleUrls: ['./business-photos.scss'],
})
export class BusinessPhotosPage {
  private readonly session = inject(UserSessionService);
  private readonly media = inject(MediaService);
  private readonly mediaCompression = inject(MediaCompressionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly maxShopImages = MAX_SHOP_IMAGES;
  shopImages = signal<string[]>([]);
  logoUrl = signal('');
  uploadingImage = signal(false);
  uploadingLogo = signal(false);
  saving = signal(false);

  async onShopImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const uid = this.session.user()?.uid;
    if (!uid) return;

    for (const file of files) {
      if (this.shopImages().length >= MAX_SHOP_IMAGES) {
        this.toast.show(`You can add up to ${MAX_SHOP_IMAGES} shop images.`, 'warning');
        break;
      }
      if (!file.type.startsWith('image/')) continue;

      this.uploadingImage.set(true);
      try {
        const { file: compressed } = await this.mediaCompression.compress(file);
        const ext = compressed.name.split('.').pop() ?? 'jpg';
        const path = `business/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const url = await this.media.uploadFile(path, compressed);
        this.shopImages.update((imgs) => [...imgs, url]);
      } catch {
        this.toast.show('Could not upload that image.', 'warning');
      } finally {
        this.uploadingImage.set(false);
      }
    }
  }

  removeShopImage(index: number): void {
    this.shopImages.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  // ── Drag-to-reorder (plain HTML5 DnD, no @angular/cdk dependency) ───────
  draggedShopImageIndex = signal<number | null>(null);
  shopImageDropTargetIndex = signal<number | null>(null);

  onShopImageDragStart(index: number, event: DragEvent): void {
    this.draggedShopImageIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onShopImageDragOver(index: number, event: DragEvent): void {
    if (this.draggedShopImageIndex() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.shopImageDropTargetIndex.set(index);
  }

  onShopImageDrop(index: number, event: DragEvent): void {
    event.preventDefault();
    const from = this.draggedShopImageIndex();
    this.draggedShopImageIndex.set(null);
    this.shopImageDropTargetIndex.set(null);
    if (from === null || from === index) return;

    this.shopImages.update((imgs) => {
      const next = [...imgs];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return imgs;
      next.splice(index, 0, moved);
      return next;
    });
  }

  onShopImageDragEnd(): void {
    this.draggedShopImageIndex.set(null);
    this.shopImageDropTargetIndex.set(null);
  }

  async onLogoSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const uid = this.session.user()?.uid;
    if (!file || !uid || !file.type.startsWith('image/')) return;

    this.uploadingLogo.set(true);
    try {
      const { file: compressed } = await this.mediaCompression.compress(file);
      const ext = compressed.name.split('.').pop() ?? 'jpg';
      const path = `avatars/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await this.media.uploadFile(path, compressed);
      this.logoUrl.set(url);
    } catch {
      this.toast.show('Could not upload the logo.', 'warning');
    } finally {
      this.uploadingLogo.set(false);
    }
  }

  removeLogo(): void {
    this.logoUrl.set('');
  }

  async save(): Promise<void> {
    if (this.shopImages().length < 1) {
      this.toast.show('Add at least one shop photo to continue.', 'warning');
      return;
    }
    const user = this.session.user();
    if (!user) return;

    this.saving.set(true);
    try {
      const saved = await this.session.updateBusinessProfile({
        businessName: user.businessName ?? '',
        businessPhone: user.businessPhone ?? '',
        businessWebsite: user.businessWebsite ?? '',
        businessImages: this.shopImages(),
        ...(this.logoUrl() ? { avatarUrl: this.logoUrl() } : {}),
      });
      if (saved) {
        this.router.navigateByUrl('/feed-beta');
      } else {
        this.toast.show('Could not save your photos. Please try again.', 'danger');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
