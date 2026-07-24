import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService, DEFAULT_MVP_FLAGS } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FeatureFlagsService],
    });
    service = TestBed.inject(FeatureFlagsService);
  });

  it('should initialize with default lean MVP flags', () => {
    expect(service.enableChatmateAi()).toBe(DEFAULT_MVP_FLAGS.enableChatmateAi);
    expect(service.enableGroupChatrooms()).toBe(DEFAULT_MVP_FLAGS.enableGroupChatrooms);
    expect(service.enableBulletinBoard()).toBe(DEFAULT_MVP_FLAGS.enableBulletinBoard);
    expect(service.enableCivicQuests()).toBe(DEFAULT_MVP_FLAGS.enableCivicQuests);
    expect(service.enableExtraThemes()).toBe(DEFAULT_MVP_FLAGS.enableExtraThemes);
    expect(service.enableAnalytics()).toBe(DEFAULT_MVP_FLAGS.enableAnalytics);
    expect(service.enableHoodIsland()).toBe(DEFAULT_MVP_FLAGS.enableHoodIsland);
  });

  it('should update feature flags when setFlag is called', () => {
    service.setFlag('enableChatmateAi', true);
    expect(service.enableChatmateAi()).toBeTrue();

    service.setFlag('enableExtraThemes', true);
    expect(service.enableExtraThemes()).toBeTrue();

    service.setFlag('enableAnalytics', true);
    expect(service.enableAnalytics()).toBeTrue();
  });
});
