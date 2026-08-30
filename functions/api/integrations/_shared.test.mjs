import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPubliclyFetchableUrl, isVideoUrl, buildInstagramCaption } from './_shared.js';

describe('isPubliclyFetchableUrl', () => {
  test('accepts a public https URL', () => {
    assert.equal(
      isPubliclyFetchableUrl(
        'https://myproject.supabase.co/storage/v1/object/public/tag-images/a.jpg',
      ),
      true,
    );
  });

  test('rejects http (non-https)', () => {
    assert.equal(isPubliclyFetchableUrl('http://example.com/a.jpg'), false);
  });

  test('rejects localhost and private network hosts', () => {
    assert.equal(isPubliclyFetchableUrl('https://localhost/a.jpg'), false);
    assert.equal(isPubliclyFetchableUrl('https://127.0.0.1/a.jpg'), false);
    assert.equal(isPubliclyFetchableUrl('https://10.0.0.5/a.jpg'), false);
    assert.equal(isPubliclyFetchableUrl('https://192.168.1.10/a.jpg'), false);
    assert.equal(isPubliclyFetchableUrl('https://172.16.0.1/a.jpg'), false);
  });

  test('rejects blob/file URLs and malformed input', () => {
    assert.equal(isPubliclyFetchableUrl('blob:https://app.example/abc'), false);
    assert.equal(isPubliclyFetchableUrl('file:///etc/passwd'), false);
    assert.equal(isPubliclyFetchableUrl('not a url'), false);
  });
});

describe('isVideoUrl', () => {
  test('recognizes common video extensions, including with a query string', () => {
    assert.equal(isVideoUrl('https://cdn.example/a.mp4?token=x'), true);
    assert.equal(isVideoUrl('https://cdn.example/a.mov'), true);
    assert.equal(isVideoUrl('https://cdn.example/a.webm'), true);
  });

  test('treats images as non-video', () => {
    assert.equal(isVideoUrl('https://cdn.example/a.jpg'), false);
    assert.equal(isVideoUrl('https://cdn.example/a.png?x=1'), false);
  });
});

describe('buildInstagramCaption', () => {
  test('combines title and highlight when both are present', () => {
    const caption = buildInstagramCaption({ title: 'Weekend Sale', highlight: '20% off pizzas!' });
    assert.equal(caption, 'Weekend Sale\n\n20% off pizzas!');
  });

  test('falls back to highlight alone when there is no title', () => {
    assert.equal(buildInstagramCaption({ highlight: 'Just the highlight' }), 'Just the highlight');
  });

  test("truncates captions over Instagram's 2200-character limit", () => {
    const longHighlight = 'x'.repeat(2500);
    const caption = buildInstagramCaption({ highlight: longHighlight });
    assert.equal(caption.length, 2200);
    assert.ok(caption.endsWith('…'));
  });
});
