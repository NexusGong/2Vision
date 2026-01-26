/*
 * 后台管理相关API
 */

export interface UserListItem {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  is_active: boolean;
  is_admin: boolean;
  is_vip: boolean;
  free_tokens: number;  // 统一免费token
  token_balance: number;  // 统一付费token余额
  total_usage_count: number;
  total_token_used: number;
  created_at: string;
}

export interface UsageStats {
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  total_usage_count: number;
  total_token_used: number;
  anonymous_usage_count: number;
  registered_usage_count: number;
  usage_by_type: Record<string, number>;
  usage_trend: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * 获取所有用户列表
 */
export const getAllUsers = async (
  page: number = 1,
  pageSize: number = 20,
  search?: string
): Promise<{
  status: string;
  data: UserListItem[];
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = `/api/admin/users?page=${page}&page_size=${pageSize}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户列表失败");
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

  const response = await fetch("/api/admin/usage_stats", {
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
 * 获取所有支付记录
 */
export const getAllPayments = async (
  page: number = 1,
  pageSize: number = 20,
  statusFilter?: string
): Promise<{
  status: string;
  data: Array<{
    id: number;
    user_id: number;
    username: string;
    email: string;
    payment_type: string;
    amount: number;
    quantity: number;
    status: string;
    payment_method: string;
    transaction_id: string;
    created_at: string;
    completed_at?: string;
  }>;
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = `/api/admin/payments?page=${page}&page_size=${pageSize}`;
  if (statusFilter) {
    url += `&status_filter=${statusFilter}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取支付记录失败");
  }

  return response.json();
};

/**
 * 获取详细使用记录
 */
export const getUsageRecords = async (
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    user_id?: number;
    usage_type?: string;
    start_date?: string;
    end_date?: string;
    country?: string;
    device_type?: string;
    api_endpoint?: string;
  }
): Promise<{
  status: string;
  data: any[];
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = `/api/admin/usage/records?page=${page}&page_size=${pageSize}`;
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url += `&${key}=${encodeURIComponent(value)}`;
      }
    });
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取使用记录失败");
  }

  return response.json();
};

/**
 * 获取使用分析数据
 */
export const getUsageAnalytics = async (
  timeRange: string = "7d",
  groupBy: string = "day"
): Promise<{
  status: string;
  data: {
    time_range: string;
    group_by: string;
    time_stats: Array<{ time: string; count: number }>;
    usage_by_type: Record<string, number>;
    location_by_country: Record<string, number>;
    device_by_type: Record<string, number>;
    token_stats: {
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
      avg_tokens: number;
    };
    active_users: number;
  };
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(
    `/api/admin/usage/analytics?time_range=${timeRange}&group_by=${groupBy}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取分析数据失败");
  }

  return response.json();
};

/**
 * 获取实时监控数据
 */
export const getRealtimeMonitoring = async (): Promise<{
  status: string;
  data: {
    recent_1h: number;
    recent_24h: number;
    active_users_1h: number;
    recent_records: any[];
  };
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/admin/monitoring/realtime", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取实时监控数据失败");
  }

  return response.json();
};

/**
 * 获取系统健康状态
 */
export const getSystemHealth = async (): Promise<{
  status: string;
  data: {
    total_requests_1h: number;
    error_requests_1h: number;
    error_rate: number;
    avg_response_time_ms: number;
    status: string;
  };
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/admin/monitoring/health", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取系统健康状态失败");
  }

  return response.json();
};

/**
 * 获取用户详情
 */
export const getUserDetail = async (userId: number): Promise<any> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户详情失败");
  }

  return response.json();
};

/**
 * 获取用户活动记录
 */
export const getUserActivity = async (
  userId: number,
  page: number = 1
): Promise<any> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(
    `/api/admin/users/${userId}/activity?page=${page}&page_size=50`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户活动失败");
  }

  return response.json();
};

/**
 * 获取用户统计
 */
export const getUserStats = async (userId: number): Promise<any> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`/api/admin/users/${userId}/stats`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户统计失败");
  }

  return response.json();
};

/**
 * 更新用户信息
 */
export const updateUser = async (
  userId: number,
  userData: {
    username?: string;
    email?: string;
    password?: string;
    nickname?: string;
    is_active?: boolean;
    is_admin?: boolean;
    is_vip?: boolean;
    free_usage_count?: number;
    total_usage_count?: number;
    total_token_used?: number;
  }
): Promise<{
  status: string;
  message: string;
  data: UserListItem;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "更新用户信息失败");
  }

  return response.json();
};

// ============ 成本监控 ============

export interface CostOverview {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_records: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_cost: number;
    total_sale: number;
    total_profit: number;
    profit_margin: number;
  };
  by_type: Record<string, {
    count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;
    sale: number;
    profit: number;
    profit_margin: number;
    avg_cost_per_record: number;
    avg_sale_per_record: number;
  }>;
}

/**
 * 获取成本概览
 */
export const getCostOverview = async (
  startDate?: string,
  endDate?: string,
  usageType?: string
): Promise<{
  status: string;
  data: CostOverview;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = "/api/admin/cost/overview?";
  if (startDate) url += `start_date=${encodeURIComponent(startDate)}&`;
  if (endDate) url += `end_date=${encodeURIComponent(endDate)}&`;
  if (usageType) url += `usage_type=${encodeURIComponent(usageType)}&`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取成本概览失败");
  }

  return response.json();
};

export interface CostByUser {
  user_id: number;
  username: string;
  email?: string;
  total_records: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost: number;
  total_sale: number;
  total_profit: number;
  profit_margin: number;
  by_type: Record<string, {
    count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;
    sale: number;
    profit: number;
  }>;
}

/**
 * 按用户获取成本统计
 */
export const getCostByUser = async (
  startDate?: string,
  endDate?: string,
  userId?: number,
  page: number = 1,
  pageSize: number = 50
): Promise<{
  status: string;
  data: CostByUser[];
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = `/api/admin/cost/by-user?page=${page}&page_size=${pageSize}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (userId) url += `&user_id=${userId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取用户成本统计失败");
  }

  return response.json();
};

export interface CostDetailed {
  id: number;
  user_id?: number;
  username?: string;
  usage_type: string;
  api_endpoint?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  sale: number;
  profit: number;
  profit_margin: number;
  response_status?: number;
  created_at: string;
}

/**
 * 获取详细成本记录
 */
export const getCostDetailed = async (
  startDate?: string,
  endDate?: string,
  userId?: number,
  usageType?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{
  status: string;
  data: CostDetailed[];
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  let url = `/api/admin/cost/detailed?page=${page}&page_size=${pageSize}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (userId) url += `&user_id=${userId}`;
  if (usageType) url += `&usage_type=${encodeURIComponent(usageType)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取详细成本记录失败");
  }

  return response.json();
};
