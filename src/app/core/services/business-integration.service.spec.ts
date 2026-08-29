import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BusinessIntegrationService } from './business-integration.service';
import { SupabaseService } from './supabase.service';
import { IntegrationProvider, IntegrationStatus } from '../enums/integration.enum';
import { BusinessIntegrationRow } from './social.mapper';

describe('BusinessIntegrationService', () => {
  let service: BusinessIntegrationService;
  let getRowsSpy: jasmine.Spy;
  let updateRowsWhereSpy: jasmine.Spy;

  beforeEach(() => {
    getRowsSpy = jasmine.createSpy('getRows').and.returnValue(of({ data: [], error: null }));
    updateRowsWhereSpy = jasmine
      .createSpy('updateRowsWhere')
      .and.returnValue(of({ data: null, error: null }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { getRows: getRowsSpy, updateRowsWhere: updateRowsWhereSpy },
        },
      ],
    });
    service = TestBed.inject(BusinessIntegrationService);
  });

  it('reads only from the safe `my_business_integrations` view — never the base table', () => {
    // Business isolation and token-safety both live in this view (see the
    // business-integrations migration): it's already scoped to `auth.uid()`
    // and structurally excludes token columns. Reading the base table
    // directly here would bypass none of the security, but would be an easy
    // regression to introduce by accident — this test guards the call site.
    service.getBusinessIntegrations().subscribe();
    expect(getRowsSpy).toHaveBeenCalledWith('my_business_integrations');
    expect(getRowsSpy).not.toHaveBeenCalledWith('business_integrations');
  });

  it('synthesizes "not connected" summaries for providers with no row at all', (done) => {
    service.getConnectionSummaries().subscribe((summaries) => {
      expect(summaries.length).toBe(Object.values(IntegrationProvider).length);
      expect(summaries.every((s) => !s.connected)).toBeTrue();
      expect(summaries.every((s) => s.status === IntegrationStatus.Disconnected)).toBeTrue();
      done();
    });
  });

  it('lets Instagram and WhatsApp connections coexist independently', (done) => {
    const rows: BusinessIntegrationRow[] = [
      {
        id: '1',
        user_id: 'u1',
        provider: 'instagram',
        status: 'connected',
        provider_account_id: 'ig-1',
        provider_account_name: '@shop',
        token_expires_at: null,
        created_at: 'now',
        updated_at: 'now',
      },
      {
        id: '2',
        user_id: 'u1',
        provider: 'whatsapp',
        status: 'disconnected',
        provider_account_id: null,
        provider_account_name: null,
        token_expires_at: null,
        created_at: 'now',
        updated_at: 'now',
      },
    ];
    getRowsSpy.and.returnValue(of({ data: rows, error: null }));

    service.getConnectionSummaries().subscribe((summaries) => {
      const instagram = summaries.find((s) => s.provider === IntegrationProvider.Instagram);
      const whatsapp = summaries.find((s) => s.provider === IntegrationProvider.Whatsapp);
      expect(instagram?.connected).toBeTrue();
      expect(instagram?.accountName).toBe('@shop');
      expect(whatsapp?.connected).toBeFalse();
      done();
    });
  });

  it('disconnect only ever requests status: disconnected (self-service cannot set any other status)', () => {
    service.disconnectIntegration('u1', IntegrationProvider.Instagram).subscribe();
    expect(updateRowsWhereSpy).toHaveBeenCalledWith(
      'business_integrations',
      { user_id: 'u1', provider: IntegrationProvider.Instagram },
      { status: IntegrationStatus.Disconnected },
    );
  });
});
