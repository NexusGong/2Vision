/**
 * 页面访问记录 API（公开，无需登录）
 */

export const recordVisit = async (sessionId: string | null): Promise<void> => {
  try {
    await fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId || undefined }),
    });
  } catch {
    // 静默失败，不影响用户使用
  }
};
