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
      
      {/* 用户菜单栏 */}
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
                <div>
                  {userMenuItems.map((item) => (
                    <div
                      key={item.key}
                      onClick={item.onClick}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--color-bg-4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                  ))}
                </div>
              }
            >
              <Avatar size={32} style={{ cursor: "pointer" }}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="avatar" />
                ) : (
                  user?.nickname?.[0] || user?.username[0]
                )}
              </Avatar>
            </Dropdown>
          </>
        ) : (
          <Button type="primary" onClick={() => setAuthModalVisible(true)}>
            登录/注册
          </Button>
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
