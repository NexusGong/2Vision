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
  free_tokens: number;  // 统一免费token
  token_balance: number;  // 统一付费token余额
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
 * 获取剩余统一token余额（支持登录和非登录用户）
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

  const response = await fetch(`/api/user/usage/remaining`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取剩余token失败");
  }

  return response.json();
};

/**
 * 获取使用统计（已废弃，请使用getUserBalance）
 * @deprecated 使用 getUserBalance 代替
 */
export const getUsageStats = async (): Promise<UsageStats> => {
  // 为了向后兼容，调用getUserBalance并转换格式
  const balance = await getUserBalance();
  return {
    remaining_count: balance.data.total_remaining,
    total_usage_count: balance.data.image.total_used + balance.data.video.total_used,
    total_token_used: balance.data.used_tokens,
    recent_usage: [
      ...balance.data.image.recent_usage.map(r => ({
        id: r.id,
        usage_type: r.usage_type,
        token_used: r.token_used,
        created_at: r.created_at
      })),
      ...balance.data.video.recent_usage.map(r => ({
        id: r.id,
        usage_type: r.usage_type,
        token_used: r.token_used,
        created_at: r.created_at
      }))
    ]
  };
};

/**
 * 获取用户使用统计（统一token系统，返回统一token余额和分别的生成次数）
 */
export const getUserBalance = async (): Promise<{
  status: string;
  data: {
    total_remaining: number;  // 统一token剩余
    used_tokens: number;      // 统一token已使用
    image: {
      total_used: number;       // 图像生成次数
      used_tokens: number;      // 图像生成已使用的token
      recent_usage: Array<{
        id: number;
        usage_type: string;
        token_used: number;
        total_tokens: number;
        created_at: string;
      }>;
    };
    video: {
      total_used: number;       // 视频生成次数
      used_tokens: number;      // 视频生成已使用的token
      recent_usage: Array<{
        id: number;
        usage_type: string;
        token_used: number;
        total_tokens: number;
        created_at: string;
      }>;
    };
  };
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/user/balance", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取余额失败");
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
