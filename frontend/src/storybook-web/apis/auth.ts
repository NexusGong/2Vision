/*
 * 认证相关API
 */

export interface LoginRequest {
  // 使用邮箱作为登录标识
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: UserResponse;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
  is_active: boolean;
  is_admin: boolean;
  is_vip: boolean;
  free_usage_count: number;
  total_usage_count: number;
}

export interface OAuthLoginRequest {
  provider: string; // wechat/github/google
  code: string;
  state?: string;
}

/**
 * 用户注册
 */
export const register = async (data: RegisterRequest): Promise<UserResponse> => {
  // 确保数据格式正确
  const requestData = {
    username: data.username,
    email: data.email,
    password: data.password,
  };
  
  console.log("发送注册请求:", requestData); // 调试用
  
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    // 处理 422 验证错误，显示详细的字段错误信息
    if (response.status === 422 && errorData.detail) {
      if (Array.isArray(errorData.detail)) {
        const errorMessages = errorData.detail.map((err: any) => {
          const field = err.loc ? err.loc.join('.') : '';
          return `${field}: ${err.msg}`;
        }).join(', ');
        throw new Error(errorMessages || "注册信息格式不正确");
      }
    }
    throw new Error(errorData.detail || "注册失败");
  }

  return response.json();
};

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<TokenResponse> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      // OAuth2PasswordRequestForm 要求字段名为 username，这里用邮箱填充
      username: data.email,
      password: data.password,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "登录失败");
  }

  return response.json();
};

/**
 * 第三方登录
 */
export const oauthLogin = async (
  provider: string,
  data: OAuthLoginRequest
): Promise<TokenResponse> => {
  const response = await fetch(`/api/auth/oauth/${provider}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "第三方登录失败");
  }

  return response.json();
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      throw new Error("登录已过期，请重新登录");
    }
    const error = await response.json();
    throw new Error(error.detail || "获取用户信息失败");
  }

  return response.json();
};

/**
 * 用户登出
 */
export const logout = async (): Promise<void> => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("登出请求失败:", error);
    }
  }
  localStorage.removeItem("token");
  localStorage.removeItem("session_id");
};

/**
 * 生成或获取session_id（用于非登录用户）
 */
export const getOrCreateSessionId = (): string => {
  let sessionId = localStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("session_id", sessionId);
  }
  return sessionId;
};
