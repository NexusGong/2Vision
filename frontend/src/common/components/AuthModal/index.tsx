/*
 * 认证模态框 - 支持验证码登录和密码登录
 */
import React, { useState, useEffect, useRef } from "react";
import { Modal, Message } from "@arco-design/web-react";
import { sendSmsCode, registerBySms, loginBySms, loginByPassword, type TokenResponse } from "@/storybook-web/apis/auth";
import styles from "./index.module.less";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

type Step = "phone" | "code" | "username" | "password";
type LoginMode = "sms" | "password";

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>("phone");
  const [loginMode, setLoginMode] = useState<LoginMode>("sms");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [userExists, setUserExists] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (!visible) {
      setStep("phone");
      setLoginMode("sms");
      setPhone("");
      setPhoneError("");
      setCode("");
      setPassword("");
      setPasswordError("");
      setUsername("");
      setUsernameError("");
      setCountdown(0);
      setUserExists(false);
      setLoading(false); // 确保关闭时重置loading状态
    }
  }, [visible]);

  const handleSendCode = async () => {
    const trimmed = phone.trim().replace(/[\s-]/g, "");
    if (!trimmed) {
      setPhoneError("请输入手机号");
      return;
    }
    if (!/^1\d{10}$/.test(trimmed)) {
      setPhoneError("请输入正确的手机号");
      return;
    }
    if (!agreed) {
      Message.warning("请先同意用户协议");
      return;
    }

    try {
      setLoading(true);
      const res = await sendSmsCode({ phone: trimmed });
      setPhone(trimmed);
      setUserExists(res.user_exists);
      setStep("code");
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (e) {
      Message.error(e instanceof Error ? e.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    const trimmed = phone.trim().replace(/[\s-]/g, "");
    if (!trimmed) {
      setPhoneError("请输入手机号");
      return;
    }
    if (!/^1\d{10}$/.test(trimmed)) {
      setPhoneError("请输入正确的手机号");
      return;
    }
    if (!password) {
      setPasswordError("请输入密码");
      return;
    }
    if (!agreed) {
      Message.warning("请先同意用户协议");
      return;
    }

    try {
      setLoading(true);
      setPhoneError("");
      setPasswordError("");
      
      console.log("开始密码登录，手机号:", trimmed.substring(0, 3) + "****");
      
      // 添加超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("请求超时，请检查网络连接")), 15000); // 15秒超时
      });
      
      const res = await Promise.race([
        loginByPassword({ phone: trimmed, password }),
        timeoutPromise
      ]) as TokenResponse;
      
      console.log("登录成功，收到token");
      localStorage.setItem("token", res.access_token);
      Message.success("登录成功");
      
      // 重置状态（在关闭前）
      setLoading(false);
      setPassword("");
      
      // 先关闭弹窗，然后异步刷新用户信息（不阻塞UI）
      onClose();
      
      // 异步调用onSuccess，不等待完成
      Promise.resolve(onSuccess(res.access_token)).catch((error) => {
        console.error("登录后刷新用户信息失败:", error);
        // 即使失败也不影响登录流程
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "登录失败";
      console.error("登录错误:", e, { message: msg });
      
      // 确保loading状态被重置
      setLoading(false);
      
      if (msg.includes("未设置密码")) {
        Message.warning("该账号未设置密码，请使用验证码登录");
        setLoginMode("sms");
      } else if (msg.includes("超时")) {
        Message.error("登录请求超时，请检查网络连接后重试");
      } else {
        Message.error(msg || "登录失败，请重试");
      }
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      setLoading(true);
      await sendSmsCode({ phone });
      setCountdown(60);
      setCode("");
      codeRefs.current.forEach(r => r && (r.value = ""));
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (e) {
      Message.error(e instanceof Error ? e.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;

    if (v.length > 1) {
      const digits = v.slice(0, 6 - i).split("");
      const arr = code.split("");
      digits.forEach((d, j) => {
        if (i + j < 6) arr[i + j] = d;
      });
      const newCode = arr.join("").slice(0, 6);
      setCode(newCode);
      codeRefs.current.forEach((r, j) => r && (r.value = newCode[j] || ""));
      codeRefs.current[Math.min(i + digits.length, 5)]?.focus();
      if (newCode.length === 6) setTimeout(() => doVerify(newCode), 200);
      return;
    }

    const arr = code.split("");
    arr[i] = v;
    const newCode = arr.join("").slice(0, 6);
    setCode(newCode);
    if (codeRefs.current[i]) codeRefs.current[i]!.value = v;
    if (v && i < 5) codeRefs.current[i + 1]?.focus();
    if (newCode.length === 6) setTimeout(() => doVerify(newCode), 200);
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  };

  const doVerify = async (verifyCode: string) => {
    if (verifyCode.length !== 6 || loading) return;

    if (userExists) {
      try {
        setLoading(true);
        console.log("开始验证码登录，手机号:", phone.substring(0, 3) + "****");
        
        // 添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("请求超时，请检查网络连接")), 15000); // 15秒超时
        });
        
        const res = await Promise.race([
          loginBySms({ phone, code: verifyCode }),
          timeoutPromise
        ]) as TokenResponse;
        
        console.log("登录成功，收到token");
        localStorage.setItem("token", res.access_token);
        Message.success("登录成功");
        
        // 重置状态（在关闭前）
        setLoading(false);
        setCode("");
        codeRefs.current.forEach(r => r && (r.value = ""));
        
        // 先关闭弹窗，然后异步刷新用户信息（不阻塞UI）
        onClose();
        
        // 异步调用onSuccess，不等待完成
        Promise.resolve(onSuccess(res.access_token)).catch((error) => {
          console.error("登录后刷新用户信息失败:", error);
          // 即使失败也不影响登录流程
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "验证码错误";
        console.error("登录错误:", e, { message: msg });
        
        // 确保loading状态被重置
        setLoading(false);
        
        if (msg.includes("超时")) {
          Message.error("登录请求超时，请检查网络连接后重试");
        } else {
          Message.error(msg || "验证码错误，请重试");
        }
        setCode("");
        codeRefs.current.forEach(r => r && (r.value = ""));
        codeRefs.current[0]?.focus();
      }
    } else {
      setStep("username");
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) {
      setUsernameError("请输入用户名");
      return;
    }
    if (username.length < 3) {
      setUsernameError("用户名至少3个字符");
      return;
    }
    if (username.length > 20) {
      setUsernameError("用户名最多20个字符");
      return;
    }

    try {
      setLoading(true);
      setUsernameError("");
      
      // 添加超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("请求超时，请检查网络连接")), 15000); // 15秒超时
      });
      
      const res = await Promise.race([
        registerBySms({ username: username.trim(), phone, code }),
        timeoutPromise
      ]) as TokenResponse;
      
      localStorage.setItem("token", res.access_token);
      Message.success("注册成功");
      
      // 先关闭弹窗，然后异步刷新用户信息（不阻塞UI）
      onClose();
      
      // 重置状态
      setLoading(false);
      setUsername("");
      setCode("");
      codeRefs.current.forEach(r => r && (r.value = ""));
      
      // 异步调用onSuccess，不等待完成
      Promise.resolve(onSuccess(res.access_token)).catch((error) => {
        console.error("注册后刷新用户信息失败:", error);
        // 即使失败也不影响注册流程
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "注册失败";
      console.error("注册错误:", e);
      
      if (msg.includes("超时")) {
        Message.error("注册请求超时，请检查网络连接后重试");
      } else {
        Message.error(msg || "注册失败，请重试");
      }
      
      if (msg.includes("验证码")) {
        setStep("code");
        setCode("");
        codeRefs.current.forEach(r => r && (r.value = ""));
        codeRefs.current[0]?.focus();
      }
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === "code") {
      setStep("phone");
      setCode("");
    } else if (step === "username") {
      setStep("code");
      setUsername("");
      setUsernameError("");
    }
  };

  const switchLoginMode = (mode: LoginMode) => {
    setLoginMode(mode);
    setPhoneError("");
    setPasswordError("");
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      wrapClassName="cyber-modal-wrapper"
      className={styles["auth-modal"]}
      style={{ width: 400 }}
      closable={false}
    >
      <div className={styles.container}>
        {/* 关闭按钮 */}
        <button className={styles["close-btn"]} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* 手机号页面 */}
        {step === "phone" && (
          <>
            <div className={styles.title}>欢迎使用 2Vision</div>
            <div className={styles.subtitle}>请输入手机号登录</div>

            {/* 登录方式切换 */}
            <div className={styles["login-mode-tabs"]}>
              <button
                className={`${styles["mode-tab"]} ${loginMode === "sms" ? styles.active : ""}`}
                onClick={() => switchLoginMode("sms")}
              >
                验证码登录
              </button>
              <button
                className={`${styles["mode-tab"]} ${loginMode === "password" ? styles.active : ""}`}
                onClick={() => switchLoginMode("password")}
              >
                密码登录
              </button>
            </div>

            <div className={styles["phone-input"]}>
              <div className={styles["country-code"]}>
                +86
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div className={styles["phone-field"]}>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  maxLength={11}
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    setPhoneError("");
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (loginMode === "sms") {
                        handleSendCode();
                      } else {
                        // 密码模式下，如果有密码就登录，否则聚焦密码框
                        if (password) {
                          handlePasswordLogin();
                        }
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            {phoneError && <div className={styles["error-text"]}>{phoneError}</div>}

            {/* 密码输入框 - 仅密码登录模式显示 */}
            {loginMode === "password" && (
              <>
                <div className={styles["input-box"]} style={{ marginTop: 12 }}>
                  <input
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
                  />
                </div>
                {passwordError && <div className={styles["error-text"]}>{passwordError}</div>}
              </>
            )}

            <button
              className={`${styles["submit-btn"]} ${
                loginMode === "sms" 
                  ? (phone.length === 11 ? styles.active : "")
                  : (phone.length === 11 && password ? styles.active : "")
              }`}
              onClick={loginMode === "sms" ? handleSendCode : handlePasswordLogin}
              disabled={loading}
            >
              {loading 
                ? (loginMode === "sms" ? "发送中..." : "登录中...")
                : (loginMode === "sms" ? "获取验证码" : "登录")
              }
            </button>

            {loginMode === "password" && (
              <div className={styles["password-hint"]}>
                没有密码？请先使用验证码登录后在个人资料中设置
              </div>
            )}

            <div className={styles.agreement}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
              />
              <span>
                登录即表示同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a>
              </span>
            </div>
          </>
        )}

        {/* 验证码页面 */}
        {step === "code" && (
          <>
            <div className={styles["nav-bar"]}>
              <button className={styles["back-btn"]} onClick={goBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                返回
              </button>
            </div>

            <div className={styles.title}>输入验证码</div>
            <div className={styles.subtitle}>
              验证码已发送至 <span className={styles.phone}>{phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3")}</span>
            </div>

            <div className={styles["code-wrapper"]}>
              <div className={styles["code-inputs"]}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <input
                    key={i}
                    ref={el => (codeRefs.current[i] = el)}
                    className={`${styles["code-box"]} ${code[i] ? styles.filled : ""}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code[i] || ""}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    onPaste={e => {
                      e.preventDefault();
                      handleCodeChange(i, e.clipboardData.getData("text").replace(/\D/g, ""));
                    }}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            <div className={styles["resend-row"]}>
              <button
                className={styles["resend-btn"]}
                disabled={countdown > 0 || loading}
                onClick={handleResend}
              >
                {countdown > 0 ? `重新发送 (${countdown}s)` : "重新发送验证码"}
              </button>
            </div>
          </>
        )}

        {/* 用户名页面 */}
        {step === "username" && (
          <>
            <div className={styles["nav-bar"]}>
              <button className={styles["back-btn"]} onClick={goBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                返回
              </button>
            </div>

            <div className={styles.title}>设置用户名</div>
            <div className={styles.subtitle}>给自己取一个名字吧</div>

            <div className={styles["input-box"]}>
              <input
                type="text"
                placeholder="请输入用户名（3-20个字符）"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setUsernameError("");
                }}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                autoFocus
              />
            </div>
            {usernameError && <div className={styles["error-text"]}>{usernameError}</div>}

            <button
              className={`${styles["submit-btn"]} ${username.length >= 3 ? styles.active : ""}`}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "注册中..." : "完成注册"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default AuthModal;
