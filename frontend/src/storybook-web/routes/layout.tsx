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

import DynamicBackground from "@/common/components/Background";

import "@arco-design/web-react/dist/css/arco.min.css";
import "../styles/arco.css";
import "../styles/global.css";
import "./index.css";

export default function Layout() {
  // 移除强制认证，允许匿名使用
  // 如果需要登录，可以通过其他方式触发（如右上角按钮）

  return (
    <>
      {/* 动态背景组件 */}
      <DynamicBackground />
      
      <Outlet />
    </>
  );
}
