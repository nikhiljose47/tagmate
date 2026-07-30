import { Injectable, signal } from '@angular/core';

export interface AppFeatureFlags {
  enableChatmateAi: boolean;
  enableGroupChatrooms: boolean;
  enableBulletinBoard: boolean;
  enableCivicQuests: boolean;
  enableExtraThemes: boolean;
  enableAnalytics: boolean;
  enableHoodIsland: boolean;
}

export const DEFAULT_MVP_FLAGS: AppFeatureFlags = {
  enableChatmateAi: false,
  enableGroupChatrooms: false,
  enableBulletinBoard: false,
  enableCivicQuests: false,
  enableExtraThemes: false,
  enableAnalytics: false,
  enableHoodIsland: false,
};

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  public readonly enableChatmateAi = signal(DEFAULT_MVP_FLAGS.enableChatmateAi);
  public readonly enableGroupChatrooms = signal(DEFAULT_MVP_FLAGS.enableGroupChatrooms);
  public readonly enableBulletinBoard = signal(DEFAULT_MVP_FLAGS.enableBulletinBoard);
  public readonly enableCivicQuests = signal(DEFAULT_MVP_FLAGS.enableCivicQuests);
  public readonly enableExtraThemes = signal(DEFAULT_MVP_FLAGS.enableExtraThemes);
  public readonly enableAnalytics = signal(DEFAULT_MVP_FLAGS.enableAnalytics);
  public readonly enableHoodIsland = signal(DEFAULT_MVP_FLAGS.enableHoodIsland);

  setFlag<K extends keyof AppFeatureFlags>(key: K, value: boolean): void {
    if (key === 'enableChatmateAi') this.enableChatmateAi.set(value);
    if (key === 'enableGroupChatrooms') this.enableGroupChatrooms.set(value);
    if (key === 'enableBulletinBoard') this.enableBulletinBoard.set(value);
    if (key === 'enableCivicQuests') this.enableCivicQuests.set(value);
    if (key === 'enableExtraThemes') this.enableExtraThemes.set(value);
    if (key === 'enableAnalytics') this.enableAnalytics.set(value);
    if (key === 'enableHoodIsland') this.enableHoodIsland.set(value);
  }
}
