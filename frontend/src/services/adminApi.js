const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '');

export class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include'
    });
  } catch {
    throw new AdminApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ', 0);
  }

  if (response.status === 204) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AdminApiError('เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง กรุณาลองอีกครั้ง', response.status);
  }

  if (!response.ok) {
    throw new AdminApiError(
      typeof payload?.error === 'string' ? payload.error : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
      response.status
    );
  }

  return payload;
}

export async function loginAdmin(credentials) {
  return requestJson('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
}

export async function logoutAdmin() {
  return requestJson('/api/admin/logout', { method: 'POST' });
}

export async function getAdminResults() {
  const results = await requestJson('/api/admin/results');
  if (!Array.isArray(results)) {
    throw new AdminApiError('รูปแบบข้อมูลผลคะแนนไม่ถูกต้อง', 502);
  }
  return results;
}

export async function getVotingStatus() {
  const result = await requestJson('/api/settings/voting');
  if (typeof result?.is_voting_open !== 'boolean') {
    throw new AdminApiError('รูปแบบสถานะโหวตไม่ถูกต้อง', 502);
  }
  return result.is_voting_open;
}

export async function updateVotingStatus(open) {
  return requestJson('/api/admin/voting', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ open })
  });
}

export async function createSinger(name, image) {
  const formData = new FormData();
  formData.set('name', name);
  formData.set('image', image);
  return requestJson('/api/admin/singers', { method: 'POST', body: formData });
}

export async function updateSingerName(singerId, name) {
  const formData = new FormData();
  formData.set('name', name);
  return requestJson(`/api/admin/singers/${encodeURIComponent(singerId)}`, {
    method: 'PUT',
    body: formData
  });
}

export async function deleteSinger(singerId) {
  return requestJson(`/api/admin/singers/${encodeURIComponent(singerId)}`, {
    method: 'DELETE'
  });
}

export function getAdminImageUrl(imageUrl) {
  if (!imageUrl) {
    return '';
  }

  try {
    return new URL(imageUrl, `${API_BASE_URL}/`).toString();
  } catch {
    return '';
  }
}
