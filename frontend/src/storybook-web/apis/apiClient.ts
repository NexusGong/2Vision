/*
 * 统一 API 客户端
 * 封装 fetch 请求、token 注入、错误处理
 */

import { getToken } from "../utils/authToken";

// 统一使用相对路径调用后端（与现有 fetch(\"/api/...\") 行为一致）
// 如需自定义后端地址，可在这里改成完整前缀，例如 "http://localhost:8000"
const API_BASE_URL = "";

export interface ApiError {
  detail?: string;
  message?: string;
  status?: number;
}

/**
 * 统一 API 请求函数
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // 获取 token 并添加到请求头
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // 处理非 JSON 响应
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response as any;
    }
    
    const data = await response.json();
    
    // 处理错误响应
    if (!response.ok) {
      const error: ApiError = {
        detail: data.detail || data.message || "请求失败",
        message: data.message || data.detail || "请求失败",
        status: response.status,
      };
      throw error;
    }
    
    return data;
  } catch (error) {
    // 如果是我们定义的错误，直接抛出
    if (error && typeof error === "object" && "detail" in error) {
      throw error;
    }
    
    // 网络错误或其他错误
    const apiError: ApiError = {
      detail: error instanceof Error ? error.message : "网络错误",
      message: error instanceof Error ? error.message : "网络错误",
    };
    throw apiError;
  }
}

/**
 * GET 请求
 */
export function apiGet<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "GET",
  });
}

/**
 * POST 请求
 */
export function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT 请求
 */
export function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE 请求
 */
export function apiDelete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
}
