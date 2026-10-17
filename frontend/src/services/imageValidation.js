const maximumImageSize = 5 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function validateSingerImage(file) {
  if (!file) {
    return { valid: false, error: 'กรุณาเลือกไฟล์รูปภาพ' };
  }

  if (file.size > maximumImageSize) {
    return { valid: false, error: 'ขนาดไฟล์ต้องไม่เกิน 5 MB' };
  }

  const extension = file.name?.split('.').pop()?.toLowerCase();
  const hasAllowedExtension = allowedImageExtensions.has(extension);
  const hasAllowedType = !file.type || allowedImageTypes.has(file.type.toLowerCase());
  if (!hasAllowedExtension || !hasAllowedType) {
    return { valid: false, error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP' };
  }

  return { valid: true, error: '' };
}

export function validateSingerSubmission(name, file) {
  if (!name.trim()) {
    return { valid: false, error: 'กรุณาระบุชื่อนักร้อง' };
  }
  return validateSingerImage(file);
}
