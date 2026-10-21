export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Returns null when the file is fine, otherwise a message for the person uploading.
export function checkUpload({ type, size }) {
  if (!UPLOAD_TYPES.includes(type)) {
    return "This file type isn't supported. Use a JPG, PNG or WebP image, or a PDF. (iPhone photos: share as JPG first.)";
  }
  if (size > MAX_UPLOAD_BYTES) {
    return `This file is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB — resize or compress it first.`;
  }
  return null;
}
