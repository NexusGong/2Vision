/*
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * Licensed under the 【火山方舟】原型应用软件自用许可协议
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at 
 *     https://www.volcengine.com/docs/82379/1433703
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Outlet } from "@modern-js/runtime/router";
import React, { useState, useEffect } from "react";
import { Button, Dropdown, Avatar } from "@arco-design/web-react";
import { IconUser, IconSettings, IconPoweroff } from "@arco-design/web-react/icon";

import DynamicBackground from "@/common/components/Background";
import AuthModal from "@/common/components/AuthModal";
import UserProfileModal from "@/common/components/UserProfile";
import PaymentModal from "@/common/components/Payment";
import { useUser, UserProvider } from "../contexts/UserContext";
import { logout, getOrCreateSessionId } from "../apis/auth";

import "@arco-design/web-react/dist/css/arco.min.css";
import "../styles/arco.css";
import "../styles/global.css";
import "../styles/cyber-theme.css";
import "./index.css";

function LayoutContent() {
  const { user, usageStats, isAuthenticated, refreshUser, refreshUsage } = useUser();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // 初始化session_id（非登录用户）
  useEffect(() => {
    if (!isAuthenticated) {
      getOrCreateSessionId();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = async (token: string) => {
    await refreshUser();
    await refreshUsage();
  };

  const handleLogout = async () => {
    await logout();
    await refreshUser();
  };

  const handlePaymentSuccess = async () => {
    await refreshUsage();
    // 剩余次数会在 useEffect 中自动更新
  };

  const userMenuItems = [
    {
      key: "profile",
      title: "个人资料",
      icon: <IconUser />,
      onClick: () => setProfileModalVisible(true),
    },
    {
      key: "payment",
      title: "会员充值",
      icon: <IconSettings />,
      onClick: () => setPaymentModalVisible(true),
    },
    {
      key: "logout",
      title: "退出登录",
      icon: <IconPoweroff />,
      onClick: handleLogout,
    },
  ];

  return (
    <>
      {/* 动态背景组件 */}
      <DynamicBackground />
      
      {/* 用户菜单栏 - 科技风样式 */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        {isAuthenticated ? (
          <>
            <Dropdown
              droplist={
                <div className="py-1" style={{ 
                  background: 'rgba(15, 15, 25, 0.95)', 
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 212, 255, 0.1)'
                }}>
                  {userMenuItems.map((item) => (
                    <div
                      key={item.key}
                      onClick={item.onClick}
                      style={{
                        padding: "10px 16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        color: "rgba(255, 255, 255, 0.8)",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(0, 212, 255, 0.1)";
                        e.currentTarget.style.color = "#00d4ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                      }}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                  ))}
                </div>
              }
            >
              <div 
                className="relative cursor-pointer group"
                style={{
                  padding: '2px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.3), rgba(177, 74, 237, 0.3))',
                }}
              >
                <Avatar 
                  size={32} 
                  style={{ 
                    cursor: "pointer",
                    background: 'rgba(15, 15, 25, 0.9)',
                    border: 'none',
                    color: '#00d4ff',
                  }}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" />
                  ) : (
                    user?.nickname?.[0] || user?.username[0]
                  )}
                </Avatar>
              </div>
            </Dropdown>
          </>
        ) : (
          <button 
            onClick={() => setAuthModalVisible(true)}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(177, 74, 237, 0.2))',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 212, 255, 0.3), rgba(177, 74, 237, 0.3))';
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(177, 74, 237, 0.2))';
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 212, 255, 0.1)';
            }}
          >
            登录
          </button>
        )}
      </div>

      <Outlet />

      {/* 认证模态框 */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 用户资料模态框 */}
      {isAuthenticated && (
        <UserProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          onUpdate={refreshUser}
        />
      )}

      {/* 支付模态框 */}
      {isAuthenticated && (
        <PaymentModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}

export default function Layout() {
  return (
    <UserProvider>
      <LayoutContent />
    </UserProvider>
  );
}
