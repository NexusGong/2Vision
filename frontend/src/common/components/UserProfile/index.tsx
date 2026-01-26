/*
 * 用户资料组件 - 科技风深色主题
 */
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Message, Avatar, Upload } from "@arco-design/web-react";
import { IconLock, IconCheck } from "@arco-design/web-react/icon";
import { getProfile, updateProfile, getUserBalance, type UserProfile, type ProfileUpdate } from "@/storybook-web/apis/user";
import { setPassword, changePassword, getPasswordStatus } from "@/storybook-web/apis/auth";
import styles from "./index.module.less";

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form] = Form.useForm<UserProfile>();
  const [balance, setBalance] = useState<{
    total_remaining: number;  // 统一token剩余
    used_tokens: number;      // 统一token已使用
    image: {
      total_used: number;       // 图像生成次数
      used_tokens: number;      // 图像生成已使用的token
    };
    video: {
      total_used: number;       // 视频生成次数
      used_tokens: number;      // 视频生成已使用的token
    };
  } | null>(null);
  
  // 密码相关状态
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (visible) {
      loadProfile();
      loadPasswordStatus();
      loadBalance();
    }
  }, [visible]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setProfile(data);
      form.setFieldsValue({
        username: data.username,
        email: data.email,
        avatar: data.avatar || "",
      });
    } catch (e) {
      Message.error(e instanceof Error ? e.message : "获取资料失败");
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const data = await getUserBalance();
      setBalance({
        total_remaining: data.data.total_remaining,
        used_tokens: data.data.used_tokens || 0,
        image: {
          total_used: data.data.image.total_used,
          used_tokens: data.data.image.used_tokens || 0,
        },
        video: {
          total_used: data.data.video.total_used,
          used_tokens: data.data.video.used_tokens || 0,
        },
      });
    } catch (e) {
      // 静默失败，不影响主流程
      console.error("获取余额失败:", e);
    }
  };

  const loadPasswordStatus = async () => {
    try {
      const status = await getPasswordStatus();
      setPasswordSet(status.password_set);
    } catch (e) {
      console.error("获取密码状态失败:", e);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);
      const data: ProfileUpdate = { avatar: values.avatar };
      const updated = await updateProfile(data);
      setProfile(updated);
      Message.success("保存成功");
      onUpdate?.();
    } catch (e) {
      Message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      form.setFieldValue("avatar", base64);
      if (profile) setProfile({ ...profile, avatar: base64 });
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validate();
      setPasswordLoading(true);
      
      if (passwordSet) {
        // 修改密码
        await changePassword({
          old_password: values.old_password,
          new_password: values.new_password,
          confirm_password: values.confirm_password,
        });
        Message.success("密码修改成功");
      } else {
        // 设置密码
        await setPassword({
          password: values.new_password,
          confirm_password: values.confirm_password,
        });
        Message.success("密码设置成功");
        setPasswordSet(true);
      }
      
      setShowPasswordModal(false);
      passwordForm.resetFields();
    } catch (e) {
      Message.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <>
      <Modal
        title="个人资料"
        visible={visible}
        onCancel={onClose}
        footer={
          <>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>保存</Button>
          </>
        }
        wrapClassName="cyber-modal-wrapper"
        className={styles["user-profile-modal"]}
        style={{ width: 420 }}
      >
        <Form form={form} layout="vertical" className={styles["profile-form"]}>
          <div className={styles["avatar-section"]}>
            <Upload accept="image/*" beforeUpload={handleAvatarChange} showUploadList={false}>
              <Avatar size={80}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" />
                ) : (
                  profile.username[0]?.toUpperCase()
                )}
              </Avatar>
            </Upload>
            <div className={styles["avatar-hint"]}>点击更换头像</div>
          </div>

          <Form.Item label="用户名" field="username">
            <Input disabled />
          </Form.Item>

          {/* 手机号 */}
          {profile.phone && (
            <Form.Item label="手机号">
              <Input value={profile.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")} disabled />
            </Form.Item>
          )}
          
          {/* 邮箱 - 只显示真实邮箱，不显示虚拟邮箱 */}
          {profile.email && !profile.email.includes("@sms.user") && (
            <Form.Item label="邮箱" field="email">
              <Input disabled />
            </Form.Item>
          )}

          {/* 密码设置区域 - 仅手机号注册用户显示 */}
          {profile.phone && (
            <div className={styles["password-section"]}>
              <div className={styles["section-title"]}>
                <IconLock className={styles["icon"]} />
                <span>登录密码</span>
              </div>
              <div className={styles["password-status"]}>
                <span className={`${styles["status-text"]} ${passwordSet ? styles["set"] : styles["not-set"]}`}>
                  {passwordSet ? (
                    <>
                      <IconCheck style={{ marginRight: 4 }} />
                      已设置密码
                    </>
                  ) : (
                    "未设置密码"
                  )}
                </span>
              </div>
              <Button
                className={styles["set-password-btn"]}
                onClick={() => setShowPasswordModal(true)}
              >
                {passwordSet ? "修改密码" : "设置密码"}
              </Button>
              {!passwordSet && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>
                  设置密码后可使用手机号+密码登录
                </div>
              )}
            </div>
          )}

          {/* 使用统计（统一token系统：显示统一token的已使用/剩余，以及分别的图像和视频生成次数） */}
          {balance && (
            <div className={styles["usage-stats"]} style={{ marginTop: 24 }}>
              <div className={styles["stats-title"]}>使用统计</div>
              
              {/* 统一Token余额 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.8)", marginBottom: 12 }}>
                  Token余额
                </div>
                <div className={styles["stats-grid"]} style={{ gridTemplateColumns: "1fr" }}>
                  <div className={styles["stat-item"]}>
                    <div className={styles["stat-value"]}>
                      {balance.used_tokens.toLocaleString()}/{balance.total_remaining.toLocaleString()}
                    </div>
                    <div className={styles["stat-label"]}>已使用/剩余</div>
                  </div>
                </div>
              </div>
              
              {/* 分析+图像生成 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.8)", marginBottom: 12 }}>
                  分析+图像生成
                </div>
                <div className={styles["stats-grid"]} style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className={styles["stat-item"]}>
                    <div className={styles["stat-value"]}>{balance.image.used_tokens.toLocaleString()}</div>
                    <div className={styles["stat-label"]}>消耗tokens</div>
                  </div>
                  <div className={styles["stat-item"]}>
                    <div className={styles["stat-value"]}>{balance.image.total_used}</div>
                    <div className={styles["stat-label"]}>生成次数</div>
                  </div>
                </div>
              </div>
              
              {/* 分析+视频生成 */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.8)", marginBottom: 12 }}>
                  分析+视频生成
                </div>
                <div className={styles["stats-grid"]} style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className={styles["stat-item"]}>
                    <div className={styles["stat-value"]}>{balance.video.used_tokens.toLocaleString()}</div>
                    <div className={styles["stat-label"]}>消耗tokens</div>
                  </div>
                  <div className={styles["stat-item"]}>
                    <div className={styles["stat-value"]}>{balance.video.total_used}</div>
                    <div className={styles["stat-label"]}>生成次数</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Form>
      </Modal>

      {/* 密码设置/修改弹窗 */}
      <Modal
        title={passwordSet ? "修改密码" : "设置密码"}
        visible={showPasswordModal}
        onCancel={() => {
          setShowPasswordModal(false);
          passwordForm.resetFields();
        }}
        footer={
          <>
            <Button onClick={() => {
              setShowPasswordModal(false);
              passwordForm.resetFields();
            }}>取消</Button>
            <Button type="primary" onClick={handlePasswordSubmit} loading={passwordLoading}>
              确定
            </Button>
          </>
        }
        wrapClassName="cyber-modal-wrapper"
        className={styles["user-profile-modal"]}
        style={{ width: 380 }}
      >
        <Form form={passwordForm} layout="vertical" className={styles["profile-form"]}>
          {passwordSet && (
            <Form.Item
              label="原密码"
              field="old_password"
              rules={[{ required: true, message: "请输入原密码" }]}
            >
              <Input.Password placeholder="请输入原密码" />
            </Form.Item>
          )}
          
          <Form.Item
            label="新密码"
            field="new_password"
            rules={[
              { required: true, message: "请输入新密码" },
              { minLength: 6, message: "密码长度至少6位" },
              { maxLength: 50, message: "密码长度不能超过50位" },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          
          <Form.Item
            label="确认密码"
            field="confirm_password"
            rules={[
              { required: true, message: "请确认密码" },
              {
                validator: (value, callback) => {
                  const newPassword = passwordForm.getFieldValue("new_password");
                  if (value !== newPassword) {
                    callback("两次输入的密码不一致");
                  } else {
                    callback();
                  }
                },
              },
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserProfileModal;
