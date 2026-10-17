const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง', 0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง กรุณาลองอีกครั้ง', response.status);
  }

  if (!response.ok) {
    throw new ApiError(
      typeof payload?.error === 'string' ? payload.error : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
      response.status
    );
  }

  return payload;
}

export async function getSingers() {
  const singers = await requestJson('/api/singers');
  if (!Array.isArray(singers)) {
    throw new ApiError('รูปแบบรายชื่อนักร้องจากเซิร์ฟเวอร์ไม่ถูกต้อง', 502);
  }
  return singers;
}

export async function getVotingStatus() {
  const status = await requestJson('/api/settings/voting');
  if (typeof status?.is_voting_open !== 'boolean') {
    throw new ApiError('รูปแบบสถานะโหวตจากเซิร์ฟเวอร์ไม่ถูกต้อง', 502);
  }
  return status.is_voting_open;
}

export async function voteForSinger(singerId) {
  return requestJson(`/api/singers/${encodeURIComponent(singerId)}/vote`, {
    method: 'POST',
    credentials: 'include'
  });
}

export function getSingerImageUrl(imageUrl) {
  if (!imageUrl) {
    return '';
  }

  try {
    return new URL(imageUrl, `${API_BASE_URL}/`).toString();
  } catch {
    return '';
  }
}
