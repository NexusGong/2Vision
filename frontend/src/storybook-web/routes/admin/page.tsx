/*
 * 管理后台入口页面（路径：/admin）
 * 与主站前台分离，只有管理员账号才能访问。
 */

import React from "react";
import { Result, Button } from "@arco-design/web-react";
import { useNavigate } from "@modern-js/runtime/router";
import { useUser } from "../../contexts/UserContext";
import AdminPanel from "../../components/AdminPanel";

const AdminPage: React.FC = () => {
  const { isAuthenticated, isAdmin } = useUser();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <Result
        status="403"
        title="未登录"
        subTitle="请先使用管理员账号登录后再访问后台。"
        extra={
          <Button type="primary" onClick={() => navigate("/")}>
            返回首页
          </Button>
        }
      />
    );
  }

  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle="当前账号不是管理员，无法访问后台管理系统。"
        extra={
          <Button type="primary" onClick={() => navigate("/")}>
            返回首页
          </Button>
        }
      />
    );
  }

  return <AdminPanel />;
};

export default AdminPage;

