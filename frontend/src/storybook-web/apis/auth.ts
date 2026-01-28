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
  email?: string | null;
  phone?: string | null;
  nickname?: string;
  avatar?: string;
  is_active: boolean;
  is_admin: boolean;
  is_vip: boolean;
  free_tokens: number;  // 统一免费token
  token_balance: number;  // 统一付费token余额
  total_usage_count: number;
  total_token_used: number;  // 总已使用token数（用于计算总量）
  password_set?: boolean;  // 是否已设置密码
}

export interface SmsSendRequest {
  phone: string;
}

export interface SmsRegisterRequest {
  username: string;
  phone: string;
  code: string;
}

export interface SmsLoginRequest {
  phone: string;
  code: string;
}

export interface PasswordLoginRequest {
  phone: string;
  password: string;
}

export interface SetPasswordRequest {
  password: string;
  confirm_password: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface PasswordStatusResponse {
  password_set: boolean;
  phone: string | null;
}

/**
 * 用户注册（短信验证码注册）
 */
export const registerBySms = async (data: SmsRegisterRequest): Promise<TokenResponse> => {
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch("/api/auth/sms/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = "注册失败";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || `注册失败 (${response.status})`;
      } catch (e) {
        errorMessage = `注册失败 (${response.status} ${response.statusText})`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接");
    }
    throw error;
  }
};

/**
 * 用户注册（邮箱注册）
 */
export const register = async (data: RegisterRequest): Promise<UserResponse> => {
  // 确保数据格式正确
  const requestData = {
    username: data.username,
    email: data.email,
    password: data.password,
  };
  
  console.log("发送注册请求:", requestData); // 调试用
  
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接");
    }
    throw error;
  }
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
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        throw new Error("登录已过期，请重新登录");
      }
      const error = await response.json().catch(() => ({ detail: "获取用户信息失败" }));
      throw new Error(error.detail || "获取用户信息失败");
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接");
    }
    throw error;
  }
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

/**
 * 发送短信验证码
 */
export const sendSmsCode = async (data: SmsSendRequest): Promise<{ message: string; phone: string; expire_minutes: number; user_exists: boolean }> => {
  const response = await fetch("/api/auth/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "发送验证码失败");
  }

  return response.json();
};


/**
 * 使用短信验证码登录
 */
export const loginBySms = async (data: SmsLoginRequest): Promise<TokenResponse> => {
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch("/api/auth/sms/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = "登录失败";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || `登录失败 (${response.status})`;
      } catch (e) {
        errorMessage = `登录失败 (${response.status} ${response.statusText})`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接");
    }
    throw error;
  }
};

/**
 * 使用手机号和密码登录
 */
export const loginByPassword = async (data: PasswordLoginRequest): Promise<TokenResponse> => {
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

  try {
    const response = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = "登录失败";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || `登录失败 (${response.status})`;
      } catch (e) {
        // 如果响应不是JSON，使用状态码
        errorMessage = `登录失败 (${response.status} ${response.statusText})`;
      }
      console.error("密码登录失败:", errorMessage, { status: response.status });
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接");
    }
    throw error;
  }
};

/**
 * 设置密码（首次设置）
 */
export const setPassword = async (data: SetPasswordRequest): Promise<{ message: string }> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/auth/password/set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "设置密码失败");
  }

  return response.json();
};

/**
 * 修改密码
 */
export const changePassword = async (data: ChangePasswordRequest): Promise<{ message: string }> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/auth/password/change", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "修改密码失败");
  }

  return response.json();
};

/**
 * 获取密码设置状态
 */
export const getPasswordStatus = async (): Promise<PasswordStatusResponse> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/auth/password/status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取密码状态失败");
  }

  return response.json();
};
