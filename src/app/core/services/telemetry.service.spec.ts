import { TestBed } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';
import { LoggerService } from './logger.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let loggerSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    loggerSpy = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        TelemetryService,
        { provide: LoggerService, useValue: loggerSpy }
      ]
    });
    service = TestBed.inject(TelemetryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call captureException and log it locally', () => {
    const error = new Error('Test error');
    service.captureException(error, { detail: 'context' });
    expect(loggerSpy.error).toHaveBeenCalledWith('Telemetry captureException:', error, { detail: 'context' });
  });

  it('should call captureMessage and log it locally', () => {
    service.captureMessage('Test message', 'info', { detail: 'context' });
    expect(loggerSpy.info).toHaveBeenCalledWith('Telemetry captureMessage [info]: Test message', { detail: 'context' });
  });
});
