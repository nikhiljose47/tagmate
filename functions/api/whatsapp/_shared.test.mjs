import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinServiceWindow, isForwardStatusTransition } from './_shared.js';

describe('isWithinServiceWindow', () => {
  test('true when the customer messaged within the last 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(isWithinServiceWindow(twoHoursAgo), true);
  });

  test('false once more than 24 hours have passed', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(isWithinServiceWindow(threeDaysAgo), false);
  });

  test('false when the customer has never messaged', () => {
    assert.equal(isWithinServiceWindow(null), false);
  });
});

describe('isForwardStatusTransition', () => {
  test('sent -> delivered -> read is always forward', () => {
    assert.equal(isForwardStatusTransition('sent', 'delivered'), true);
    assert.equal(isForwardStatusTransition('delivered', 'read'), true);
  });

  test('rejects a stale/out-of-order webhook moving status backwards', () => {
    assert.equal(isForwardStatusTransition('read', 'delivered'), false);
    assert.equal(isForwardStatusTransition('delivered', 'sent'), false);
  });

  test('a duplicate delivery of the same status is not a forward move', () => {
    assert.equal(isForwardStatusTransition('delivered', 'delivered'), false);
  });

  test('failed can supersede queued/sent but not delivered/read', () => {
    assert.equal(isForwardStatusTransition('sent', 'failed'), true);
    assert.equal(isForwardStatusTransition('delivered', 'failed'), false);
    assert.equal(isForwardStatusTransition('read', 'failed'), false);
  });
});
