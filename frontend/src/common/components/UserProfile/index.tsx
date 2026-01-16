/*
 * 用户资料组件（模仿豆包风格）
 */
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Message, Avatar, Upload } from "@arco-design/web-react";
import { getProfile, updateProfile, type UserProfile, type ProfileUpdate } from "@/storybook-web/apis/user";
import "./index.module.less";

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // 表单类型包含所有字段（包括只读的 username 和 email）
  const [form] = Form.useForm<UserProfile>();

  useEffect(() => {
    if (visible) {
      loadProfile();
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
        nickname: data.nickname || "",
        avatar: data.avatar || "",
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "获取用户资料失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);
      // 只提交可更新的字段（nickname 和 avatar）
      const updateData: ProfileUpdate = {
        nickname: values.nickname,
        avatar: values.avatar,
      };
      const updated = await updateProfile(updateData);
      setProfile(updated);
      Message.success("更新成功");
      onUpdate?.();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      form.setFieldValue("avatar", base64);
    };
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  if (!profile) {
    return null;
  }

  return (
    <Modal
      title="个人资料"
      visible={visible}
      onCancel={onClose}
      footer={
        <div>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            保存
          </Button>
        </div>
      }
      className="user-profile-modal"
      style={{ width: 500 }}
    >
      <Form form={form} layout="vertical">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Upload
            accept="image/*"
            beforeUpload={handleAvatarChange}
            showUploadList={false}
          >
            <Avatar size={80} style={{ cursor: "pointer" }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="avatar" />
              ) : (
                profile.nickname?.[0] || profile.username[0]
              )}
            </Avatar>
          </Upload>
          <div style={{ marginTop: 8, color: "#86909c" }}>点击头像更换</div>
        </div>
        <Form.Item label="用户名" field="username">
          <Input disabled />
        </Form.Item>
        <Form.Item label="邮箱" field="email">
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="昵称"
          field="nickname"
          rules={[{ maxLength: 50, message: "昵称不能超过50个字符" }]}
        >
          <Input placeholder="请输入昵称" />
        </Form.Item>
        <div style={{ marginTop: 16, padding: 12, background: "#f7f8fa", borderRadius: 4 }}>
          <div style={{ marginBottom: 8 }}>使用统计</div>
          <div style={{ fontSize: 12, color: "#86909c" }}>
            剩余次数: {profile.free_usage_count} | 总使用: {profile.total_usage_count}
          </div>
        </div>
      </Form>
    </Modal>
  );
};

export default UserProfileModal;
