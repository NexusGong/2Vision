/*
 * 用户状态管理Context
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUser, type UserResponse } from "../apis/auth";
import { getUsageStats, type UsageStats } from "../apis/user";

interface UserContextType {
  user: UserResponse | null;
  usageStats: UsageStats | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setUsageStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error("获取用户信息失败:", error);
      setUser(null);
      setUsageStats(null);
      // 只有在401错误时才清除token，其他错误可能是网络问题
      if (error instanceof Error && error.message.includes("登录已过期")) {
        localStorage.removeItem("token");
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshUsage = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUsageStats(null);
      return;
    }

    try {
      const stats = await getUsageStats();
      setUsageStats(stats);
    } catch (error) {
      console.error("获取使用统计失败:", error);
      setUsageStats(null);
    }
  };

  useEffect(() => {
    // 初始化时检查token，如果有token则刷新用户信息
    const token = localStorage.getItem("token");
    if (token) {
      refreshUser();
    } else {
      // 没有token时直接设置loading为false
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshUsage();
    }
  }, [user]);

  return (
    <UserContext.Provider
      value={{
        user,
        usageStats,
        isAuthenticated: !!user,
        isAdmin: user?.is_admin || false,
        loading,
        refreshUser,
        refreshUsage,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
