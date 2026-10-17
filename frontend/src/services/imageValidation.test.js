import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateSingerImage,
  validateSingerSubmission
} from './imageValidation.js';

describe('validateSingerImage', () => {
  it('is the client-side file validation function', () => {
    assert.equal(typeof validateSingerImage, 'function');
  });

  it('rejects unsupported file types', () => {
    assert.deepEqual(
      validateSingerImage({
        name: 'portrait.gif',
        size: 1024,
        type: 'image/gif'
      }),
      { valid: false, error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP' }
    );
  });

  it('rejects files larger than 5 MB', () => {
    assert.deepEqual(
      validateSingerImage({
        name: 'portrait.png',
        size: 5 * 1024 * 1024 + 1,
        type: 'image/png'
      }),
      { valid: false, error: 'ขนาดไฟล์ต้องไม่เกิน 5 MB' }
    );
  });

  it('accepts supported image files at or below 5 MB', () => {
    assert.deepEqual(
      validateSingerImage({
        name: 'portrait.webp',
        size: 5 * 1024 * 1024,
        type: 'image/webp'
      }),
      { valid: true, error: '' }
    );
  });

  it('rejects a supported extension with a conflicting MIME type', () => {
    assert.equal(
      validateSingerImage({
        name: 'portrait.jpg',
        size: 1024,
        type: 'application/pdf'
      }).valid,
      false
    );
  });

  it('allows submit after a valid selected file is stored for preview', () => {
    const selectedFile = {
      name: 'portrait.png',
      size: 1024,
      type: 'image/png'
    };

    assert.deepEqual(validateSingerSubmission('Singer', selectedFile), {
      valid: true,
      error: ''
    });
  });
});
