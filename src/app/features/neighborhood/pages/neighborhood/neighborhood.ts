import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, RouterLink, TagEmojiPipe, TagGradientPipe],
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

  // Tab state
  protected readonly activeTab = signal<'overview' | 'ai' | 'leaderboard'>('overview');

  // AI Chat states
  protected readonly messages = signal<Array<{ sender: 'user' | 'ai'; text: string; link?: Tag; time: Date }>>([]);
  protected readonly userInput = signal('');
  protected readonly isTyping = signal(false);

  // Preset chips
  protected readonly aiPresets = [
    { label: 'Summarize Hood activity 📢', q: 'summarize' },
    { label: 'Any road / traffic alerts? 🚗', q: 'traffic' },
    { label: 'Show me sales & deals 🛒', q: 'sales' },
    { label: 'Are there any events? 🎉', q: 'events' },
  ];

  // Quests list
  protected readonly questsList = [
    { id: 'love', name: 'Civic Love', desc: 'React to an active neighborhood post with love.', icon: 'bi-heart-fill', points: 5 },
    { id: 'comment', name: 'Chatty Neighbor', desc: 'Contribute a comment to a local post.', icon: 'bi-chat-dots-fill', points: 5 },
    { id: 'rsvp', name: 'Active Citizen', desc: 'RSVP to an upcoming event tag.', icon: 'bi-calendar-check-fill', points: 5 },
    { id: 'poll', name: 'Vocal Resident', desc: 'Cast a vote in a neighborhood question poll.', icon: 'bi-check-circle-fill', points: 5 }
  ];

  // Quest progress computed
  protected readonly completedQuestsCount = computed(() => {
    return this.questsList.filter(q => this.social.isQuestCompleted(q.id)).length;
  });

  protected readonly questsProgress = computed(() => {
    if (this.questsList.length === 0) return 0;
    return Math.round((this.completedQuestsCount() / this.questsList.length) * 100);
  });

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
    const counts = new Map<string, { name: string; count: number }>();
    for (const post of this.neighborhoodPosts()) {
      const uid = post.userId;
      if (!uid) continue;
      const entry = counts.get(uid);
      if (entry) entry.count++;
      else counts.set(uid, { name: post.username || 'Anonymous', count: 1 });
    }
    return [...counts.entries()]
      .map(([uid, { name, count }]) => ({ uid, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  protected readonly myUid = computed(() => this.social.myUid());

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'overview' || requestedTab === 'ai' || requestedTab === 'leaderboard') {
      this.activeTab.set(requestedTab);
    }

    this.tagRepo.getAll().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
        this.initAiChat();
      },
      error: (err) => {
        this.logger.error('Failed to load neighborhood posts', err);
        this.isLoading.set(false);
      },
    });
  }

  protected setTab(tab: 'overview' | 'ai' | 'leaderboard'): void {
    this.activeTab.set(tab);
    if (tab === 'ai') {
      this.initAiChat();
    }
  }

  private initAiChat(): void {
    if (this.messages().length === 0) {
      this.messages.set([
        {
          sender: 'ai',
          text: `Hi neighbor! I'm your local Tagmate AI Concierge for ${this.name}. Ask me about traffic alerts, active sales, local events, or neighborhood highlights!`,
          time: new Date()
        }
      ]);
    }
  }

  protected sendAiMessage(queryText?: string): void {
    const text = (queryText || this.userInput()).trim();
    if (!text) return;

    if (!queryText) {
      this.userInput.set('');
    }

    this.messages.update(prev => [...prev, { sender: 'user', text, time: new Date() }]);
    this.isTyping.set(true);

    setTimeout(() => {
      this.generateAiResponse(text);
      this.isTyping.set(false);
    }, 900);
  }

  private generateAiResponse(text: string): void {
    const query = text.toLowerCase();
    const activePosts = this.neighborhoodPosts();
    let replyText = '';
    let foundPost: Tag | undefined = undefined;

    if (query === 'summarize') {
      const total = activePosts.length;
      if (total === 0) {
        replyText = `There are currently no active tags in ${this.name}. Be the first neighbor to post an update!`;
      } else {
        const categoriesMap = new Map<string, number>();
        activePosts.forEach(p => categoriesMap.set(p.tag, (categoriesMap.get(p.tag) ?? 0) + 1));
        const summaryParts = [...categoriesMap.entries()].map(([tag, count]) => `${count} ${tag}${count > 1 ? 's' : ''}`);
        replyText = `Currently in ${this.name}, we have ${total} active post${total > 1 ? 's' : ''}: ${summaryParts.join(', ')}. `;
        const highlight = activePosts.find(p => p.highlight);
        if (highlight) {
          replyText += `The most recent update is by @${highlight.username || 'anonymous'}: "${highlight.highlight}". Check it out on the map below!`;
          foundPost = highlight;
        }
      }
    } else if (query.includes('traffic') || query.includes('road') || query.includes('accident') || query.includes('alert') || query.includes('hazard')) {
      const matches = activePosts.filter(p => p.tag === 'traffic' || p.tag === 'alert');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Yes, neighbor! There's a road update posted by @${item.username}: "${item.highlight}". I've linked it below so you can locate it on the map.`;
        foundPost = item;
      } else {
        replyText = `Good news! There are no active traffic alerts or road incidents reported in ${this.name} right now. Stay safe!`;
      }
    } else if (query.includes('sale') || query.includes('deal') || query.includes('discount') || query.includes('market') || query.includes('shop')) {
      const matches = activePosts.filter(p => p.tag === 'sale' || p.tag === 'market');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Here's a deal! @${item.username} posted a sale: "${item.highlight}". Check the attachment link below to find it!`;
        foundPost = item;
      } else {
        replyText = `It looks like there are no active sales or marketplace deals posted in ${this.name} today. Let us know if you spot a good bargain!`;
      }
    } else if (query.includes('event') || query.includes('meetup') || query.includes('party') || query.includes('gathering') || query.includes('calendar')) {
      const matches = activePosts.filter(p => p.tag === 'event');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Mark your calendar! We have an event coming up: "${item.highlight}" hosted by @${item.username}. Click the link below to RSVP!`;
        foundPost = item;
      } else {
        replyText = `No upcoming community events or meetups are posted in ${this.name} at the moment. Feel free to create one!`;
      }
    } else if (query.includes('food') || query.includes('eat') || query.includes('restaurant') || query.includes('cafe')) {
      const matches = activePosts.filter(p => p.tag === 'food');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Hungry? @${item.username} recommended: "${item.highlight}". I've linked it below so you can check out the spot!`;
        foundPost = item;
      } else {
        replyText = `No food tags or restaurant recommendations have been posted in ${this.name} recently. If you know a great place, pin it!`;
      }
    } else if (query.includes('question') || query.includes('poll') || query.includes('help')) {
      const matches = activePosts.filter(p => p.tag === 'question');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `A neighbor is asking: "${item.highlight}". Click the link below to cast your vote or answer their question!`;
        foundPost = item;
      } else {
        replyText = `There are no active neighborhood questions or polls open in ${this.name} right now.`;
      }
    } else {
      const matchingPost = activePosts.find(p => p.highlight.toLowerCase().includes(query));
      if (matchingPost) {
        replyText = `I found a matching post in the neighborhood: "${matchingPost.highlight}" by @${matchingPost.username}. Check the link below!`;
        foundPost = matchingPost;
      } else {
        replyText = `I couldn't find any specific matches for "${text}" in ${this.name}'s active tags. Try asking for "traffic alerts", "upcoming events", "sales" or a "summary"!`;
      }
    }

    this.messages.update(prev => [...prev, {
      sender: 'ai',
      text: replyText,
      link: foundPost,
      time: new Date()
    }]);
  }

  protected resetQuests(): void {
    if (confirm('Reset your reputation points and quest progress for testing?')) {
      this.social.resetQuests();
    }
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
