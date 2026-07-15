import { TestBed } from '@angular/core/testing';
import { GlobalErrorHandler } from './global-error.handler';
import { LoggerService } from '../services/logger.service';
import { TelemetryService } from '../services/telemetry.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let telemetrySpy: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
    loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    telemetrySpy = jasmine.createSpyObj('TelemetryService', ['captureException']);

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: LoggerService, useValue: loggerSpy },
        { provide: TelemetryService, useValue: telemetrySpy },
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('should be created', () => {
    expect(handler).toBeTruthy();
  });

  it('should log and capture uncaught exceptions', () => {
    const error = new Error('Global error test');
    if (typeof window !== 'undefined' && 'reportError' in window) {
      spyOn(window, 'reportError').and.stub();
    }
    handler.handleError(error);
    expect(loggerSpy.error).toHaveBeenCalled();
    expect(telemetrySpy.captureException).toHaveBeenCalledWith(error, {
      message: 'Global error test',
    });
  });
});
