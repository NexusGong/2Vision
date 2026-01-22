/*
 * 用户相关API
 */

export interface UserProfile {
  id: number;
  username: string;
  email?: string;  // 可选，手机号注册用户可能没有真实邮箱
  phone?: string;  // 手机号
  nickname?: string;
  avatar?: string;
  is_admin: boolean;
  is_vip: boolean;
  vip_expires_at?: string;
  free_usage_count: number;
  total_usage_count: number;
  total_token_used: number;
  created_at: string;
}

export interface ProfileUpdate {
  nickname?: string;
  avatar?: string; // Base64编码
}

export interface UsageStats {
  remaining_count: number;
  total_usage_count: number;
  total_token_used: number;
  recent_usage: Array<{
    id: number;
    usage_type: string;
    token_used: number;
    created_at: string;
  }>;
}

/**
 * 获取用户资料
 */
export const getProfile = async (): Promise<UserProfile> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/user/profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户资料失败");
  }

  return response.json();
};

/**
 * 更新用户资料
 */
export const updateProfile = async (
  data: ProfileUpdate
): Promise<UserProfile> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/user/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "更新用户资料失败");
  }

  return response.json();
};

/**
 * 获取剩余使用次数（支持登录和非登录用户）
 */
export const getRemainingUsage = async (): Promise<{
  remaining_count: number;
  total_count: number;
  is_anonymous: boolean;
}> => {
  const token = localStorage.getItem("token");
  const sessionId = localStorage.getItem("session_id") || "";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-Session-Id"] = sessionId;
  }

  const response = await fetch("/api/user/usage/remaining", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取剩余次数失败");
  }

  return response.json();
};

/**
 * 获取使用统计
 */
export const getUsageStats = async (): Promise<UsageStats> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/user/usage", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取使用统计失败");
  }

  return response.json();
};

/**
 * 获取用户历史记录
 */
export const getUserHistory = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{
  status: string;
  data: Array<{
    id: number;
    title: string;
    original_text: string;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(
    `/api/user/history?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取历史记录失败");
  }

  return response.json();
};
