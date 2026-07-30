import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone,
  computed,
  inject,
  signal,
  effect,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { environment } from '../../../../environments/environment';
import { Tag } from '../../../../core/models/tag.model';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FeatureFlagsService } from '../../../../core/services/feature-flags.service';

@Component({
  selector: 'app-neighborhood',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TagEmojiPipe, TagGradientPipe, TimeAgoPipe],
  templateUrl: './neighborhood.html',
  styleUrl: './neighborhood.scss',
})
export class NeighborhoodPage implements OnInit, OnDestroy {
  @ViewChild('hoodMapEl', { static: true }) private hoodMapEl?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly shared = inject(SharedStateService);
  private readonly logger = inject(LoggerService);
  protected readonly social = inject(SocialInteractionsService);
  private readonly sessionService = inject(UserSessionService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly platform = inject(SocialPlatformService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly featureFlags = inject(FeatureFlagsService);

  private static readonly _mlPromise = import('maplibre-gl');
  private hoodMaplib?: typeof import('maplibre-gl');
  private hoodMap?: MapLibreMap;
  private hoodMapMarkers: MapLibreMarker[] = [];
  private hoodMapInitialized = false;
  private hoodResizeObs?: ResizeObserver;

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly slug = this.route.snapshot.paramMap.get('id') || 'nearby';
  protected readonly name = this.titleFromSlug(this.slug);

  // Tab state — map is the default landing tab
  protected readonly activeTab = signal<
    'map' | 'overview' | 'ai' | 'leaderboard' | 'bulletin' | 'chat'
  >('map');

  public readonly availableTabs = computed(() => {
    const tabs: Array<{
      id: 'map' | 'overview' | 'ai' | 'leaderboard' | 'bulletin' | 'chat';
      label: string;
      icon: string;
    }> = [
      { id: 'map', label: 'Map', icon: 'bi-map-fill' },
      { id: 'overview', label: 'Overview', icon: 'bi-grid-fill' },
    ];
    if (this.featureFlags.enableGroupChatrooms()) {
      tabs.push({ id: 'chat', label: 'Chat', icon: 'bi-chat-left-text-fill' });
    }
    if (this.featureFlags.enableBulletinBoard()) {
      tabs.push({ id: 'bulletin', label: 'Board', icon: 'bi-pin-angle-fill' });
    }
    if (this.featureFlags.enableChatmateAi()) {
      tabs.push({ id: 'ai', label: 'AI', icon: 'bi-cpu-fill' });
    }
    if (this.featureFlags.enableCivicQuests()) {
      tabs.push({ id: 'leaderboard', label: 'Champion', icon: 'bi-trophy-fill' });
    }
    return tabs;
  });

  // Group Chat states
  protected readonly chatInput = signal('');
  protected readonly isChatLoading = signal(false);

  // AI Chat states
  protected readonly messages = signal<
    Array<{ sender: 'user' | 'ai'; text: string; link?: Tag; time: Date }>
  >([]);
  protected readonly userInput = signal('');
  protected readonly isTyping = signal(false);

  // Preset chips
  protected readonly aiPresets = [
    { label: 'Summarize Hood activity 📢', q: 'summarize' },
    { label: 'Any road / traffic alerts? 🚗', q: 'traffic' },
    { label: 'Show me sales & deals 🛒', q: 'sales' },
    { label: 'Are there any events? 🎉', q: 'events' },
  ];

  // Bulletin Board states
  protected readonly noteInput = signal('');
  protected readonly isSticking = signal(false);

  protected readonly bulletinNotes = computed(() => {
    return this.posts()
      .filter((post) => post.tag === 'bulletin')
      .filter((post) => this.slugFor(post.hoodId || 'nearby') === this.slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  protected readonly bulletinColors = [
    'bg-[#fef9c3] dark:bg-yellow-950/40 text-yellow-900 dark:text-yellow-100 border-[#fef08a] dark:border-yellow-900/60',
    'bg-[#dbeafe] dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 border-[#bfdbfe] dark:border-blue-900/60',
    'bg-[#dcfce7] dark:bg-green-950/40 text-green-900 dark:text-green-100 border-[#bbf7d0] dark:border-green-900/60',
    'bg-[#fce7f3] dark:bg-pink-950/40 text-pink-900 dark:text-pink-100 border-[#fbcfe8] dark:border-pink-900/60',
    'bg-[#fef3c7] dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-[#fde68a] dark:border-amber-900/60',
  ];

  protected getNoteColorClass(index: number): string {
    return this.bulletinColors[index % this.bulletinColors.length];
  }

  private readonly AI_KEYWORDS = {
    summarize: [
      'summarize',
      'summary',
      'activity',
      'overview',
      'posts',
      'update',
      'status',
      'recent',
      'happen',
      'latest',
      'news',
    ],
    traffic: [
      'traffic',
      'road',
      'accident',
      'alert',
      'hazard',
      'block',
      'closure',
      'route',
      'congestion',
      'delay',
      'detour',
      'street',
      'construction',
      'crash',
      'police',
    ],
    sales: [
      'sale',
      'deal',
      'discount',
      'market',
      'shop',
      'offer',
      'price',
      'buy',
      'sell',
      'cheap',
      'bargain',
      'store',
      'grocery',
      'opening',
      'mall',
    ],
    events: [
      'event',
      'meetup',
      'party',
      'gathering',
      'calendar',
      'show',
      'concert',
      'festival',
      'meeting',
      'schedule',
      'sunrise',
      'sunset',
      'music',
      'yoga',
      'gig',
    ],
    food: [
      'food',
      'eat',
      'restaurant',
      'cafe',
      'diner',
      'lunch',
      'dinner',
      'breakfast',
      'snack',
      'menu',
      'delicious',
      'stall',
      'reopening',
      'dosa',
      'hungry',
      'hotel',
      'coffee',
    ],
    questions: [
      'question',
      'poll',
      'help',
      'ask',
      'inquiry',
      'opinion',
      'vote',
      'anyone',
      'know',
      'where',
      'lost',
      'find',
    ],
  };

  // Quests list
  protected readonly questsList = [
    {
      id: 'love',
      name: 'Civic Love',
      desc: 'React to an active neighborhood post with love.',
      icon: 'bi-heart-fill',
      points: 5,
    },
    {
      id: 'comment',
      name: 'Chatty Neighbor',
      desc: 'Contribute a comment to a local post.',
      icon: 'bi-chat-dots-fill',
      points: 5,
    },
    {
      id: 'rsvp',
      name: 'Active Citizen',
      desc: 'RSVP to an upcoming event tag.',
      icon: 'bi-calendar-check-fill',
      points: 5,
    },
    {
      id: 'poll',
      name: 'Vocal Resident',
      desc: 'Cast a vote in a neighborhood question poll.',
      icon: 'bi-check-circle-fill',
      points: 5,
    },
  ];

  // Quest progress computed
  protected readonly completedQuestsCount = computed(() => {
    return this.questsList.filter((q) => this.social.isQuestCompleted(q.id)).length;
  });

  protected readonly questsProgress = computed(() => {
    if (this.questsList.length === 0) return 0;
    return Math.round((this.completedQuestsCount() / this.questsList.length) * 100);
  });

  protected readonly neighborhoodPosts = computed(() =>
    this.posts()
      .filter((post) => !this.social.isHidden(post))
      .filter((post) => !this.platform.isBlocked(post.userId))
      .filter((post) => this.slugFor(post.hoodId || 'nearby') === this.slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
  protected readonly followHoodId = computed(
    () => this.neighborhoodPosts()[0]?.hoodId || this.name,
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

  constructor() {
    effect(() => {
      const msgs = this.social.activeChatMessages();
      if (this.activeTab() === 'chat' && msgs.length > 0) {
        this.scrollToBottom();
      }
    });

    effect(() => {
      if (this.activeTab() !== 'map') return;
      const hasPosts = this.neighborhoodPosts().some((p) => p.lat && p.lng);
      if (this.hoodMapInitialized) {
        setTimeout(() => {
          this.hoodMap?.resize();
          if (hasPosts) this.updateHoodMarkers();
        }, 50);
      } else if (hasPosts) {
        setTimeout(() => void this.initHoodMap(), 50);
      }
    });
  }

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (
      requestedTab === 'map' ||
      requestedTab === 'overview' ||
      requestedTab === 'ai' ||
      requestedTab === 'leaderboard' ||
      requestedTab === 'bulletin' ||
      requestedTab === 'chat'
    ) {
      this.activeTab.set(requestedTab as any);
      if (requestedTab === 'chat') {
        this.loadGroupChat();
      }
    }

    const filter = this.slug !== 'nearby' ? { hoodId: this.name } : undefined;
    this.tagRepo
      .getFiltered(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

    this.tagRepo
      .liveTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((post) => this.mergeLivePost(post));
    this.tagRepo
      .liveTagUpdates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((post) => this.mergeLivePost(post));
  }

  ngOnDestroy(): void {
    this.hoodResizeObs?.disconnect();
    this.hoodMapMarkers.forEach((m) => m.remove());
    this.hoodMap?.remove();
  }

  protected setTab(tab: 'map' | 'overview' | 'ai' | 'leaderboard' | 'bulletin' | 'chat'): void {
    this.activeTab.set(tab);
    if (tab === 'ai') {
      this.initAiChat();
    } else if (tab === 'chat') {
      this.loadGroupChat();
    }
  }

  protected async toggleHoodFollow(): Promise<void> {
    const hoodId = this.followHoodId();
    const enabled = await this.platform.toggleFollowHood(hoodId);
    this.toast.show(enabled ? `Following ${this.name}.` : `Unfollowed ${this.name}.`, 'success');
  }

  private mergeLivePost(post: Tag): void {
    if (this.slugFor(post.hoodId || 'nearby') !== this.slug) return;
    this.posts.update((items) => [
      post,
      ...items.filter((item) => this.social.postKey(item) !== this.social.postKey(post)),
    ]);
  }

  protected loadGroupChat(): void {
    this.isChatLoading.set(true);
    this.social.loadGroupMessages(this.slug);
    setTimeout(() => {
      this.isChatLoading.set(false);
      this.scrollToBottom();
    }, 300);
  }

  protected sendChatMessage(): void {
    const text = this.chatInput().trim();
    if (!text) return;
    this.social.sendGroupMessage(this.slug, text);
    this.chatInput.set('');
    this.scrollToBottom();
  }

  protected scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.chat-log-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  private initAiChat(): void {
    if (this.messages().length === 0) {
      this.messages.set([
        {
          sender: 'ai',
          text: `Hi neighbor! I'm your local Tagmate AI Concierge for ${this.name}. Ask me about traffic alerts, active sales, local events, or neighborhood highlights!`,
          time: new Date(),
        },
      ]);
    }
  }

  protected sendAiMessage(queryText?: string): void {
    const text = (queryText || this.userInput()).trim();
    if (!text) return;

    if (!queryText) {
      this.userInput.set('');
    }

    this.messages.update((prev) => [...prev, { sender: 'user', text, time: new Date() }]);
    this.isTyping.set(true);

    setTimeout(() => {
      this.generateAiResponse(text);
      this.isTyping.set(false);
    }, 900);
  }

  private generateAiResponse(text: string): void {
    const query = text.toLowerCase();
    const words = query.split(/\W+/).filter(Boolean);
    const activePosts = this.neighborhoodPosts();
    let replyText = '';
    let foundPost: Tag | undefined = undefined;

    const matchesSummarize = this.AI_KEYWORDS.summarize.some(
      (w) => query.includes(w) || words.includes(w),
    );
    const matchesTraffic = this.AI_KEYWORDS.traffic.some(
      (w) => query.includes(w) || words.includes(w),
    );
    const matchesSales = this.AI_KEYWORDS.sales.some((w) => query.includes(w) || words.includes(w));
    const matchesEvents = this.AI_KEYWORDS.events.some(
      (w) => query.includes(w) || words.includes(w),
    );
    const matchesFood = this.AI_KEYWORDS.food.some((w) => query.includes(w) || words.includes(w));
    const matchesQuestions = this.AI_KEYWORDS.questions.some(
      (w) => query.includes(w) || words.includes(w),
    );

    if (
      query === 'summarize' ||
      (matchesSummarize &&
        !matchesTraffic &&
        !matchesSales &&
        !matchesEvents &&
        !matchesFood &&
        !matchesQuestions)
    ) {
      const total = activePosts.length;
      if (total === 0) {
        replyText = `There are currently no active tags in ${this.name}. Be the first neighbor to post an update!`;
      } else {
        const categoriesMap = new Map<string, number>();
        activePosts.forEach((p) => categoriesMap.set(p.tag, (categoriesMap.get(p.tag) ?? 0) + 1));
        const summaryParts = [...categoriesMap.entries()].map(
          ([tag, count]) => `${count} ${tag}${count > 1 ? 's' : ''}`,
        );
        replyText = `Currently in ${this.name}, we have ${total} active post${total > 1 ? 's' : ''}: ${summaryParts.join(', ')}. `;
        const highlight = activePosts.find((p) => p.highlight);
        if (highlight) {
          replyText += `The most recent update is by @${highlight.username || 'anonymous'}: "${highlight.highlight}". Check it out on the map below!`;
          foundPost = highlight;
        }
      }
    } else if (matchesTraffic) {
      const matches = activePosts.filter((p) => p.tag === 'traffic' || p.tag === 'alert');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Yes, neighbor! There's a road update posted by @${item.username}: "${item.highlight}". I've linked it below so you can locate it on the map.`;
        foundPost = item;
      } else {
        replyText = `Good news! There are no active traffic alerts or road incidents reported in ${this.name} right now. Stay safe!`;
      }
    } else if (matchesSales) {
      const matches = activePosts.filter((p) => p.tag === 'sale' || p.tag === 'market');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Here's a deal! @${item.username} posted a sale: "${item.highlight}". Check the attachment link below to find it!`;
        foundPost = item;
      } else {
        replyText = `It looks like there are no active sales or marketplace deals posted in ${this.name} today. Let us know if you spot a good bargain!`;
      }
    } else if (matchesEvents) {
      const matches = activePosts.filter((p) => p.tag === 'event');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Mark your calendar! We have an event coming up: "${item.highlight}" hosted by @${item.username}. Click the link below to RSVP!`;
        foundPost = item;
      } else {
        replyText = `No upcoming community events or meetups are posted in ${this.name} at the moment. Feel free to create one!`;
      }
    } else if (matchesFood) {
      const matches = activePosts.filter((p) => p.tag === 'food');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Hungry? @${item.username} recommended: "${item.highlight}". I've linked it below so you can check out the spot!`;
        foundPost = item;
      } else {
        replyText = `No food tags or restaurant recommendations have been posted in ${this.name} recently. If you know a great place, pin it!`;
      }
    } else if (matchesQuestions) {
      const matches = activePosts.filter((p) => p.tag === 'question');
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `A neighbor is asking: "${item.highlight}". Click the link below to cast your vote or answer their question!`;
        foundPost = item;
      } else {
        replyText = `There are no active neighborhood questions or polls open in ${this.name} right now.`;
      }
    } else {
      const matchingPost = activePosts.find(
        (p) =>
          p.highlight.toLowerCase().includes(query) ||
          words.some((w) => p.highlight.toLowerCase().includes(w)),
      );
      if (matchingPost) {
        replyText = `I found a matching post in the neighborhood: "${matchingPost.highlight}" by @${matchingPost.username}. Check the link below!`;
        foundPost = matchingPost;
      } else {
        replyText = `I couldn't find any specific matches for "${text}" in ${this.name}'s active tags. Try asking for "traffic alerts", "upcoming events", "sales" or a "summary"!`;
      }
    }

    this.messages.update((prev) => [
      ...prev,
      {
        sender: 'ai',
        text: replyText,
        link: foundPost,
        time: new Date(),
      },
    ]);
  }

  protected stickNote(): void {
    const text = this.noteInput().trim();
    if (!text) return;

    const user = this.sessionService.user();
    const username = user?.name || 'Guest';
    const userId = user?.uid || 'guest-uid';

    this.isSticking.set(true);

    const noteObject: Tag = {
      username,
      userId,
      highlight: text,
      lat: 0,
      lng: 0,
      expiresIn: 10080, // 7 days lifespan
      tag: 'bulletin',
      createdAt: new Date().toISOString(),
      images: [],
    };

    this.tagRepo.create(noteObject).subscribe({
      next: (createdNote) => {
        this.posts.update((prev) => [createdNote, ...prev]);
        this.noteInput.set('');
        this.isSticking.set(false);
        this.social.completeQuest('comment');
      },
      error: (err) => {
        this.logger.error('Failed to stick note', err);
        this.isSticking.set(false);
      },
    });
  }

  protected async deleteNote(id: string): Promise<void> {
    const note = this.posts().find((p) => p.id === id);
    if (!note) return;

    if (note.userId !== this.myUid()) {
      this.logger.warn('Unauthorized attempt to delete a sticky note.');
      return;
    }

    const ok = await this.confirmDialog.confirm({
      title: 'Delete Note',
      message: 'Are you sure you want to delete this sticky note?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    this.tagRepo.delete(id).subscribe({
      next: () => {
        this.posts.update((prev) => prev.filter((p) => p.id !== id));
      },
      error: (err) => {
        this.logger.error('Failed to delete note', err);
      },
    });
  }

  protected async resetQuests(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Reset Quest Progress',
      message: 'Reset your reputation points and quest progress for testing?',
      confirmText: 'Reset',
      danger: true,
    });
    if (ok) {
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
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'nearby'
    );
  }

  private titleFromSlug(slug: string): string {
    return (
      slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Nearby'
    );
  }

  // ---------- map tab ----------

  private async initHoodMap(): Promise<void> {
    if (this.hoodMapInitialized) {
      this.updateHoodMarkers();
      return;
    }
    const el = this.hoodMapEl?.nativeElement;
    if (!el) return;

    const posts = this.neighborhoodPosts().filter((p) => p.lat && p.lng);
    if (!posts.length) return;

    const mod = await NeighborhoodPage._mlPromise;
    this.hoodMaplib = (mod.default ?? mod) as typeof import('maplibre-gl');
    const ml = this.hoodMaplib;
    const key = environment.mapTilerApiKey;
    const centerLat = posts.reduce((s, p) => s + p.lat, 0) / posts.length;
    const centerLng = posts.reduce((s, p) => s + p.lng, 0) / posts.length;

    this.ngZone.runOutsideAngular(() => {
      this.hoodMap = new ml.Map({
        container: el,
        style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${key}`,
        center: [centerLng, centerLat],
        zoom: 14,
        minZoom: 5,
        maxZoom: 19,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      this.hoodMap.addControl(new ml.NavigationControl({ showCompass: false }), 'bottom-right');
      this.hoodMap.on('load', () => {
        this.hoodMapInitialized = true;
        this.ngZone.run(() => {
          this.updateHoodMarkers();
          if (posts.length > 1) this.fitHoodBounds(posts);
        });
      });
      this.hoodResizeObs = new ResizeObserver(() => this.hoodMap?.resize());
      this.hoodResizeObs.observe(el);
    });
  }

  private updateHoodMarkers(): void {
    if (!this.hoodMap || !this.hoodMaplib) return;
    const ml = this.hoodMaplib;
    this.hoodMapMarkers.forEach((m) => m.remove());
    this.hoodMapMarkers = [];

    for (const post of this.neighborhoodPosts().filter((p) => p.lat && p.lng)) {
      const el = document.createElement('div');
      el.className = 'hood-map-pin';
      el.textContent = this.tagEmojiChar(post.tag);
      el.title = post.highlight || post.tag;

      const popup = new ml.Popup({ offset: 28, closeButton: true, maxWidth: '220px' }).setHTML(
        `<div class="hood-map-popup">` +
          `<strong>${this.esc(post.highlight || 'Untitled')}</strong>` +
          `<p><a href="/users/${encodeURIComponent(post.userId)}">@${this.esc(post.username || 'Anonymous')}</a> · #${this.esc(post.tag)}</p>` +
          `<a href="/posts/${encodeURIComponent(this.social.postKey(post))}">View post →</a>` +
          `</div>`,
      );

      const marker = new ml.Marker({ element: el })
        .setLngLat([post.lng, post.lat])
        .setPopup(popup)
        .addTo(this.hoodMap!);
      this.hoodMapMarkers.push(marker);
    }
  }

  private fitHoodBounds(posts: Tag[]): void {
    if (!this.hoodMap || posts.length < 2) return;
    const lngs = posts.map((p) => p.lng);
    const lats = posts.map((p) => p.lat);
    this.hoodMap.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, maxZoom: 16, duration: 300 },
    );
  }

  private tagEmojiChar(tag: string): string {
    const map: Record<string, string> = {
      event: '🎉',
      sale: '🛒',
      traffic: '🚗',
      alert: '⚠️',
      food: '🍽️',
      market: '🏪',
      question: '❓',
      bulletin: '📌',
    };
    return map[tag] ?? '📍';
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
