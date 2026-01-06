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

// AuthModal.tsx - 用户认证弹窗组件（已废弃，保留用于未来扩展）

import { useState } from 'react';
import {
  Form,
  Input,
  Message,
  Modal,
} from '@arco-design/web-react';
import type { ModalProps } from '@arco-design/web-react';

interface AuthModalProps extends Omit<ModalProps, 'onOk'> {
  onOk: (userToken: string) => void;
}

/**
 * 认证弹窗组件，用于用户输入 User Token
 * 注意：当前版本已移除强制认证，此组件保留用于未来扩展
 */
const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onOk,
  ...props
}) => {
  // 使用Arco Form的useForm创建表单实例
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 处理提交（简化版本，直接接受 token）
  const handleSubmit = async () => {
    try {
      // 使用Form的验证功能
      const values = await form.validate();
      const trimmedKey = values.userToken.trim();

      if (!trimmedKey) {
        Message.error('User Token 不能为空');
        return;
      }

      setLoading(true);
      
      // 直接接受 token，不进行验证（因为我们已经移除了强制认证）
      // 如果需要验证，可以在这里调用后端 API
      onOk(trimmedKey);
    } catch (err) {
      // Form验证失败或其他错误
      Message.error('请填写有效的 User Token');
    } finally {
      setLoading(false);
    }
  };

  // 表单校验规则
  const rules = {
    userToken: [
      {
        required: true,
        message: 'User Token 不能为空',
      },
    ],
  };

  return (
    <Modal
        title="请输入 User Token"
        visible={visible}
        onOk={handleSubmit}
        okButtonProps={{
          loading,
        }}
        closable={false}
        cancelButtonProps={{ style: { display: 'none' } }}
        {...props}
      > 
      <Form
        form={form}
        layout="vertical"
        colon={false}
        initialValues={{ userToken: '' }}
      >
        <Form.Item
          label="User Token"
          field="userToken"
          rules={rules.userToken}
        >
          <Input
            placeholder="请输入 User Token"
            disabled={loading}
            maxLength={200}
            style={{
              height: 40,
            }}
            onPressEnter={handleSubmit}
          />
        </Form.Item>
      </Form>

    </Modal>
  );
};

export default AuthModal;