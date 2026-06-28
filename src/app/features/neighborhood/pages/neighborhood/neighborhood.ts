import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Tag } from '../../../../core/models/tag.model';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';

@Component({
  selector: 'app-neighborhood',
  standalone: true,
  imports: [CommonModule, RouterLink, TagEmojiPipe, TagGradientPipe],
  templateUrl: './neighborhood.html',
  styleUrl: './neighborhood.scss',
})
export class NeighborhoodPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly shared = inject(SharedStateService);
  private readonly logger = inject(LoggerService);
  protected readonly social = inject(SocialInteractionsService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly slug = this.route.snapshot.paramMap.get('id') || 'nearby';
  protected readonly name = this.titleFromSlug(this.slug);

  protected readonly neighborhoodPosts = computed(() =>
    this.posts()
      .filter((post) => !this.social.isHidden(post))
      .filter((post) => this.slugFor(post.hoodId || 'nearby') === this.slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  protected readonly tagCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const post of this.neighborhoodPosts()) {
      counts.set(post.tag, (counts.get(post.tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  protected readonly contributors = computed(() => {
    const counts = new Map<string, number>();
    for (const post of this.neighborhoodPosts()) {
      const name = post.username || 'Anonymous';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  });

  ngOnInit(): void {
    this.tagRepo.getAll().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load neighborhood posts', err);
        this.isLoading.set(false);
      },
    });
  }

  protected openMap(post?: Tag): void {
    const target = post ?? this.neighborhoodPosts()[0];
    if (!target) return;

    this.shared.updateCoordinates(target.lat, target.lng);
    this.shared.updateText(target.hoodId || this.name);
    void this.router.navigate([AppRoute.Hood]);
  }

  private slugFor(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nearby';
  }

  private titleFromSlug(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Nearby';
  }
}
