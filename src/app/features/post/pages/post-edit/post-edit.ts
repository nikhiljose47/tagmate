import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';

@Component({
  selector: 'app-post-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TagEmojiPipe, TagGradientPipe],
  templateUrl: './post-edit.html',
  styleUrls: ['./post-edit.scss'],
})
export class PostEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly userSession = inject(UserSessionService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);

  postId = '';
  post = signal<Tag | null>(null);
  headline = signal('');
  isSubmitting = signal(false);
  isLoading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.toast.show('Post not found.', 'danger');
      void this.router.navigate(['/profile']);
      return;
    }
    this.postId = id;

    this.tagRepo.getById(id).subscribe({
      next: (tag) => {
        if (!tag) {
          this.toast.show('Post not found.', 'danger');
          void this.router.navigate(['/profile']);
          return;
        }

        // Verify ownership
        const currentUser = this.userSession.user();
        if (!currentUser || tag.userId !== currentUser.uid) {
          this.toast.show('You do not have permission to edit this post.', 'danger');
          void this.router.navigate(['/profile']);
          return;
        }

        this.post.set(tag);
        this.headline.set(tag.highlight);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load post for editing', err);
        this.toast.show('Could not load post details.', 'danger');
        void this.router.navigate(['/profile']);
      },
    });
  }

  async onSubmit(): Promise<void> {
    const trimmed = this.headline().trim();
    if (!trimmed) {
      this.toast.show('Please enter a headline.', 'warning');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await firstValueFrom(this.tagRepo.update(this.postId, { highlight: trimmed }));
      this.toast.show('Post updated successfully!', 'success');
      void this.router.navigate(['/profile']);
    } catch (err) {
      this.logger.error('Failed to update post', err);
      this.toast.show('Could not update post. Please try again.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
