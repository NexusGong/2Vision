/*
 * OAuth 回调页面
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@modern-js/runtime/router";
import { useUser } from "../../../contexts/UserContext";

const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser, refreshUsage } = useUser();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = async () => {
      const token = searchParams.get("token");
      const err = searchParams.get("error");

      if (err) {
        setStatus("error");
        setError(decodeURIComponent(err));
        return;
      }

      if (token) {
        try {
          localStorage.setItem("token", token);
          await refreshUser();
          await refreshUsage();
          setStatus("success");
          setTimeout(() => navigate("/"), 1500);
        } catch (e) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "登录失败");
        }
      } else {
        setStatus("error");
        setError("登录信息缺失");
      }
    };
    handle();
  }, [searchParams, navigate, refreshUser, refreshUsage]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8f9fa",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "56px 48px",
        width: 400,
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
      }}>
        {status === "loading" && (
          <>
            <div style={{
              width: 48,
              height: 48,
              margin: "0 auto 28px",
              border: "3px solid #f0f0f0",
              borderTopColor: "#4096ff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
              正在登录
            </div>
            <div style={{ fontSize: 14, color: "#999" }}>请稍候...</div>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{
              width: 56,
              height: 56,
              margin: "0 auto 28px",
              background: "#f0fff4",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
              登录成功
            </div>
            <div style={{ fontSize: 14, color: "#999" }}>正在跳转...</div>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{
              width: 56,
              height: 56,
              margin: "0 auto 28px",
              background: "#fff2f0",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
              登录失败
            </div>
            <div style={{ fontSize: 14, color: "#999", marginBottom: 32 }}>{error}</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => navigate("/")}
                style={{
                  padding: "12px 28px",
                  background: "linear-gradient(135deg, #4096ff 0%, #9373ee 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                返回首页
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "12px 28px",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
