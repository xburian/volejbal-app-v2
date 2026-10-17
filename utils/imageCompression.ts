/**
 * Image compression and thumbnail generation utility.
 * Optimizes user avatars into compact ~160x160 JPEG images to minimize
 * Redis storage and network transfer size (from ~1-2 MB down to ~10-20 KB).
 *
 * Gracefully falls back to FileReader in headless/unsupported environments (e.g. JSDOM).
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1, default 0.82
  mimeType?: 'image/jpeg' | 'image/webp';
  square?: boolean; // Center-crop to square avatar, default true
}

export function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Chyba při čtení souboru jako DataURL.'));
      }
    };
    reader.onerror = () => reject(new Error('Chyba při čtení souboru.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Chyba při dekódování obrázku.'));
    };
    img.src = url;
  });
}

/**
 * Compresses an image File or Blob to a base64 Data URI.
 * Automatically handles EXIF rotation via createImageBitmap if supported.
 * Falls back to FileReader Data URL if canvas 2D context is unavailable.
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxWidth = options.maxWidth ?? 160;
  const maxHeight = options.maxHeight ?? 160;
  const quality = options.quality ?? 0.82;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const square = options.square ?? true;

  if (typeof document === 'undefined') {
    return readFileAsDataUrl(file);
  }

  const testCanvas = document.createElement('canvas');
  if (!testCanvas.getContext || !testCanvas.getContext('2d')) {
    return readFileAsDataUrl(file);
  }

  let srcWidth: number;
  let srcHeight: number;
  let source: ImageBitmap | HTMLImageElement | null = null;
  let isBitmap = false;

  try {
    if (typeof createImageBitmap !== 'undefined') {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        srcWidth = source.width;
        srcHeight = source.height;
        isBitmap = true;
      } catch {
        source = await loadImageElement(file);
        srcWidth = source.naturalWidth || source.width;
        srcHeight = source.naturalHeight || source.height;
      }
    } else {
      source = await loadImageElement(file);
      srcWidth = source.naturalWidth || source.width;
      srcHeight = source.naturalHeight || source.height;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return readFileAsDataUrl(file);
    }

    if (square) {
      // Center-crop to 1:1 square for circular user avatars
      const minDim = Math.min(srcWidth, srcHeight);
      const sx = Math.floor((srcWidth - minDim) / 2);
      const sy = Math.floor((srcHeight - minDim) / 2);

      canvas.width = maxWidth;
      canvas.height = maxHeight;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, sx, sy, minDim, minDim, 0, 0, maxWidth, maxHeight);
    } else {
      // Scale proportionally within maxWidth x maxHeight
      const scale = Math.min(maxWidth / srcWidth, maxHeight / srcHeight, 1);
      const targetW = Math.round(srcWidth * scale);
      const targetH = Math.round(srcHeight * scale);

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, srcWidth, srcHeight, 0, 0, targetW, targetH);
    }

    return canvas.toDataURL(mimeType, quality);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    if (isBitmap && source && typeof (source as ImageBitmap).close === 'function') {
      (source as ImageBitmap).close();
    }
  }
}
