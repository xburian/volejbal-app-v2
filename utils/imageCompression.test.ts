import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImageFile } from './imageCompression.ts';

describe('imageCompression utility', () => {
  let mockDrawImage: any;
  let mockToDataURL: any;

  beforeEach(() => {
    mockDrawImage = vi.fn();
    mockToDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockCompressedBase64');

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: (contextId: string) => {
            if (contextId === '2d') {
              return {
                drawImage: mockDrawImage,
                imageSmoothingEnabled: false,
                imageSmoothingQuality: 'low',
              };
            }
            return null;
          },
          toDataURL: mockToDataURL,
          width: 0,
          height: 0,
        } as any;
      }
      return document.createElement(tagName);
    });
  });

  it('compresses using createImageBitmap when supported with center crop', async () => {
    const mockClose = vi.fn();
    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
      width: 400,
      height: 200,
      close: mockClose,
    });

    const file = new Blob(['dummy content'], { type: 'image/png' }) as File;
    const result = await compressImageFile(file, { maxWidth: 160, maxHeight: 160, quality: 0.85 });

    expect(result).toBe('data:image/jpeg;base64,mockCompressedBase64');
    // Center crop minDim = 200, sx = (400-200)/2 = 100, sy = 0
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      100,
      0,
      200,
      200,
      0,
      0,
      160,
      160
    );
    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(mockClose).toHaveBeenCalled();
  });

  it('supports proportional scaling when square is false', async () => {
    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 400,
      close: vi.fn(),
    });

    const file = new Blob(['dummy content'], { type: 'image/png' }) as File;
    const result = await compressImageFile(file, {
      maxWidth: 160,
      maxHeight: 160,
      square: false,
    });

    expect(result).toBe('data:image/jpeg;base64,mockCompressedBase64');
    // Scale = min(160/800 = 0.2, 160/400 = 0.4) = 0.2 -> targetW = 160, targetH = 80
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      800,
      400,
      0,
      0,
      160,
      80
    );
  });
});
