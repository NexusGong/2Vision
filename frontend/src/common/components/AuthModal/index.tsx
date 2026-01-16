/*
 * 认证模态框组件（登录/注册）
 */
import React, { useState } from "react";
import { Modal, Form, Input, Button, Message, Divider } from "@arco-design/web-react";
import { login, register, oauthLogin, getOrCreateSessionId } from "@/storybook-web/apis/auth";
import type { LoginRequest, RegisterRequest } from "@/storybook-web/apis/auth";
import "./index.module.less";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm<LoginRequest>();
  const [registerForm] = Form.useForm<RegisterRequest>();

  const handleLogin = async () => {
    try {
      const values = await loginForm.validate();
      setLoading(true);
      const result = await login(values);
      localStorage.setItem("token", result.access_token);
      Message.success("登录成功");
      onSuccess(result.access_token);
      onClose();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values?: RegisterRequest) => {
    try {
      // 如果 onSubmit 传入了值，使用传入的值；否则从表单获取
      const formValues = values || await registerForm.validate();
      
      // 确保所有必需字段都存在
      if (!formValues.username || !formValues.email || !formValues.password) {
        Message.error("请填写所有必填字段");
        return;
      }
      
      setLoading(true);
      // 明确构建请求数据
      const registerData: RegisterRequest = {
        username: String(formValues.username).trim(),
        email: String(formValues.email).trim(),
        password: String(formValues.password),
      };
      
      console.log("注册数据:", registerData); // 调试用
      await register(registerData);
      Message.success("注册成功，请登录");
      setMode("login");
      // 注册成功后，将邮箱带入登录表单
      loginForm.setFieldsValue({ email: formValues.email });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    try {
      setLoading(true);
      // 模拟OAuth流程（实际应该跳转到OAuth授权页面）
      const code = `oauth_${provider}_${Date.now()}`;
      const result = await oauthLogin(provider, { provider, code });
      localStorage.setItem("token", result.access_token);
      Message.success("登录成功");
      onSuccess(result.access_token);
      onClose();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "第三方登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={mode === "login" ? "登录" : "注册"}
      visible={visible}
      onCancel={onClose}
      footer={null}
      className="auth-modal"
      style={{ width: 400 }}
    >
      {mode === "login" ? (
        <Form form={loginForm} layout="vertical" onSubmit={handleLogin}>
          <Form.Item
            field="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              {
                type: "string",
                match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "邮箱格式不正确",
              },
            ]}
          >
            <Input placeholder="请输入登录邮箱" />
          </Form.Item>
          <Form.Item
            field="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" long loading={loading}>
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Button type="text" onClick={() => setMode("register")}>
              还没有账号？立即注册
            </Button>
          </div>
          <Divider>或</Divider>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Button onClick={() => handleOAuthLogin("wechat")} disabled={loading}>
              微信登录
            </Button>
            <Button onClick={() => handleOAuthLogin("github")} disabled={loading}>
              GitHub
            </Button>
            <Button onClick={() => handleOAuthLogin("google")} disabled={loading}>
              Google
            </Button>
          </div>
        </Form>
      ) : (
        <Form 
          form={registerForm} 
          layout="vertical" 
          onSubmit={(values) => {
            handleRegister(values as RegisterRequest);
          }}
          onSubmitFailed={(errors) => {
            console.log("表单验证失败:", errors);
          }}
        >
          <Form.Item
            field="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { minLength: 3, message: "用户名至少3个字符" },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            field="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              {
                type: "string",
                match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "邮箱格式不正确",
              },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            field="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              { minLength: 6, message: "密码至少6个字符" },
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" long loading={loading}>
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Button type="text" onClick={() => setMode("login")}>
              已有账号？立即登录
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default AuthModal;
