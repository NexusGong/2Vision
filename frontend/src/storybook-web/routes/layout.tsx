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
import { Dropdown, Avatar } from "@arco-design/web-react";
import { IconUser, IconSettings, IconPoweroff } from "@arco-design/web-react/icon";

import DynamicBackground from "@/common/components/Background";
import AuthModal from "@/common/components/AuthModal";
import UserProfileModal from "@/common/components/UserProfile";
import PaymentModal from "@/common/components/Payment";
import { useUser, UserProvider } from "../contexts/UserContext";
import { ModalProvider, useModal } from "../contexts/ModalContext";
import { logout, getOrCreateSessionId } from "../apis/auth";
import { recordVisit } from "../apis/visit";

import "@arco-design/web-react/dist/css/arco.min.css";
import "../styles/arco.css";
import "../styles/global.css";
import "../styles/cyber-theme.css";
import "./index.css";

function LayoutContent({
  authModalVisible,
  setAuthModalVisible,
  paymentModalVisible,
  setPaymentModalVisible,
}: {
  authModalVisible: boolean;
  setAuthModalVisible: (visible: boolean) => void;
  paymentModalVisible: boolean;
  setPaymentModalVisible: (visible: boolean) => void;
}) {
  const { user, isAuthenticated, refreshUser, refreshUsage } = useUser();
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // 初始化 session_id 并记录页面访问（非登录用户也会记录）
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    recordVisit(sessionId);
  }, []);

  const handleLoginSuccess = async (token: string) => {
    // 异步刷新用户信息，不阻塞UI
    // 使用setTimeout确保在下一个事件循环中执行，避免阻塞
    setTimeout(async () => {
      try {
        // 先刷新用户信息
        await refreshUser();
        // 等待一下确保user状态已更新，然后刷新使用统计
        setTimeout(async () => {
          try {
            await refreshUsage();
          } catch (error) {
            console.error("刷新使用统计失败:", error);
            // 即使失败也不影响登录流程
          }
        }, 200);
      } catch (error) {
        console.error("登录后刷新用户信息失败:", error);
        // 即使刷新失败，也不影响登录流程
        // 用户信息会在下次访问时自动刷新
      }
    }, 0);
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
      
      {/* 用户菜单栏 - 科技风样式，位置与安全区见 global.css .layout-user-menu */}
      <div
        className="layout-user-menu"
        style={{
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
                <div className="layout-user-menu-droplist py-1" style={{ 
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
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  return (
    <UserProvider>
      <ModalProvider
        openAuthModal={() => setAuthModalVisible(true)}
        openPaymentModal={() => setPaymentModalVisible(true)}
      >
        <LayoutContent
          authModalVisible={authModalVisible}
          setAuthModalVisible={setAuthModalVisible}
          paymentModalVisible={paymentModalVisible}
          setPaymentModalVisible={setPaymentModalVisible}
        />
      </ModalProvider>
    </UserProvider>
  );
}
