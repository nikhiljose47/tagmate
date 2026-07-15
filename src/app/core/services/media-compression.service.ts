import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggerService } from './logger.service';

/** Tunables for a single compression pass. All optional — sensible defaults apply. */
export interface CompressionOptions {
  /** Longest edge, in px. Larger images are scaled down proportionally (never up). */
  maxDimension?: number;
  /** Encoder quality, 0–1 (applies to WebP/JPEG). */
  quality?: number;
  /** Preferred output format. Falls back to JPEG when the browser can't encode WebP. */
  mimeType?: 'image/webp' | 'image/jpeg';
  /** Files already smaller than this (bytes) are left untouched. */
  skipUnderBytes?: number;
}

/** Outcome of a compression attempt. `file` is always safe to upload as-is. */
export interface CompressionResult {
  /** The compressed file, or the original when compression was skipped/unhelpful. */
  file: File;
  originalBytes: number;
  compressedBytes: number;
  /** compressedBytes / originalBytes (1 = unchanged). */
  ratio: number;
  didCompress: boolean;
}

// 1920px / 0.85 keeps posts crisp on the largest on-screen slot we render at
// (post-detail hero, ~760px wide, up to 3x device pixel ratio = ~2280px) while
// still cutting a typical 12MP phone photo (4000x3000, ~4-6MB) down to a few
// hundred KB. Bump maxDimension further only if a wider hero layout ships.
const DEFAULTS: Required<CompressionOptions> = {
  maxDimension: 1920,
  quality: 0.85,
  mimeType: 'image/webp',
  skipUnderBytes: 80 * 1024, // 80 KB — not worth re-encoding tiny images
};

/**
 * Client-side media compression for uploads.
 *
 * Images are decoded, scaled to a max dimension, and re-encoded (WebP → JPEG
 * fallback), shrinking both the upload and every subsequent download. Display
 * needs no matching "decompression" step: browsers decode JPEG/WebP natively.
 *
 * Videos and animated GIFs are passed through unchanged — transcoding those in
 * the browser needs ffmpeg.wasm and belongs on the server/edge.
 */
@Injectable({ providedIn: 'root' })
export class MediaCompressionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly logger = inject(LoggerService);

  /** Cached one-time check for canvas WebP encoding support. */
  private webpSupported?: boolean;

  /**
   * Compress a single file for upload. Never throws — on any failure it logs
   * and returns the original file so the upload can still proceed.
   */
  async compress(file: File, options: CompressionOptions = {}): Promise<CompressionResult> {
    const opts = { ...DEFAULTS, ...options };
    const passthrough = (f: File): CompressionResult => ({
      file: f,
      originalBytes: file.size,
      compressedBytes: f.size,
      ratio: file.size ? f.size / file.size : 1,
      didCompress: f !== file,
    });

    // Only compress raster images in a browser; everything else passes through.
    if (!isPlatformBrowser(this.platformId)) return passthrough(file);
    if (!this.isCompressibleImage(file)) return passthrough(file);
    if (file.size < opts.skipUnderBytes) return passthrough(file);

    try {
      const mime = (await this.canEncodeWebp()) ? opts.mimeType : 'image/jpeg';
      const bitmap = await this.decode(file);
      const { width, height } = this.fit(bitmap.width, bitmap.height, opts.maxDimension);

      const blob = await this.encode(bitmap, width, height, mime, opts.quality);
      if ('close' in bitmap) bitmap.close();

      // Re-encoding can occasionally produce a larger file (already-optimised
      // source, tiny dimensions). Keep whichever is smaller.
      if (!blob || blob.size >= file.size) return passthrough(file);

      const compressed = new File([blob], this.renameTo(file.name, mime), {
        type: mime,
        lastModified: file.lastModified,
      });
      this.logger.debug(
        `Compressed ${file.name}: ${this.kb(file.size)} → ${this.kb(compressed.size)} ` +
          `(${Math.round((1 - compressed.size / file.size) * 100)}% smaller)`,
      );
      return passthrough(compressed);
    } catch (err) {
      this.logger.warn('Media compression failed — uploading original.', err);
      return passthrough(file);
    }
  }

  /** Convenience: compress many files concurrently. Order is preserved. */
  compressAll(files: File[], options?: CompressionOptions): Promise<CompressionResult[]> {
    return Promise.all(
      files.map((f) =>
        this.compress(f, options).catch((err) => {
          this.logger.warn(
            'Media compression failed on compressAll, falling back to original.',
            err,
          );
          return {
            file: f,
            originalBytes: f.size,
            compressedBytes: f.size,
            ratio: 1,
            didCompress: false,
          };
        }),
      ),
    );
  }

  // ---------- internals ----------

  private isCompressibleImage(file: File): boolean {
    // GIFs are skipped: canvas re-encoding would flatten animation to one frame.
    return file.type.startsWith('image/') && file.type !== 'image/gif';
  }

  private async decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
    // createImageBitmap respects EXIF orientation and decodes off the main
    // thread where supported — preferred over an <img> element.
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        // Some browsers reject the options bag — retry without it.
        return await createImageBitmap(file);
      }
    }
    return this.decodeViaImgElement(file);
  }

  private decodeViaImgElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image decode failed'));
      };
      img.src = url;
    });
  }

  private fit(w: number, h: number, max: number): { width: number; height: number } {
    const longest = Math.max(w, h);
    if (longest <= max) return { width: w, height: h };
    const scale = max / longest;
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  private async encode(
    source: CanvasImageSource,
    width: number,
    height: number,
    mime: string,
    quality: number,
  ): Promise<Blob | null> {
    // OffscreenCanvas keeps the work off the DOM where available.
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, width, height);
      return canvas.convertToBlob({ type: mime, quality });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
  }

  /** One-time capability probe: can this browser's canvas emit WebP? */
  private async canEncodeWebp(): Promise<boolean> {
    if (this.webpSupported !== undefined) return this.webpSupported;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const probe = new OffscreenCanvas(1, 1);
        probe.getContext('2d'); // convertToBlob throws without an existing context
        const blob = await probe.convertToBlob({ type: 'image/webp' });
        this.webpSupported = blob.type === 'image/webp';
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        this.webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      }
    } catch {
      this.webpSupported = false;
    }
    return this.webpSupported;
  }

  private renameTo(name: string, mime: string): string {
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const base = name.replace(/\.[^./\\]+$/, '');
    return `${base || 'image'}.${ext}`;
  }

  private kb(bytes: number): string {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
}
