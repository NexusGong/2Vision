/*
 * 管理后台布局（独立于主站）
 * 仅负责注入 UserProvider，具体权限控制在 page.tsx 中处理
 */

import React from "react";
import { Outlet } from "@modern-js/runtime/router";
import { UserProvider } from "../../contexts/UserContext";
import "@arco-design/web-react/dist/css/arco.min.css";
import "../../styles/arco.css";
import "../../styles/global.css";
import styles from "./layout.module.less";

const AdminLayout: React.FC = () => {
  return (
    <UserProvider>
      <div className={styles.adminLayout}>
        <Outlet />
      </div>
    </UserProvider>
  );
};

export default AdminLayout;
