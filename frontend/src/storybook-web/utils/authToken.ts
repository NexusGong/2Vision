/*
 * Token 访问与管理工具
 * 统一封装 token 的获取、设置、清除操作
 * 便于未来迁移到更安全的存储方式（如 httpOnly cookie）
 */

const TOKEN_KEY = "token";
const SESSION_ID_KEY = "session_id";

/**
 * 获取访问令牌
 */
export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 设置访问令牌
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 清除访问令牌
 */
export function clearToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 获取会话ID（用于非登录用户）
 */
export function getSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SESSION_ID_KEY);
}

/**
 * 设置会话ID
 */
export function setSessionId(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

/**
 * 清除会话ID
 */
export function clearSessionId(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_ID_KEY);
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
