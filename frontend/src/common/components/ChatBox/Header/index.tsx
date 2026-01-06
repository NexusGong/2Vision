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

import React from "react";
import { IconMenu } from "@arco-design/web-react/icon";

interface HeaderProps {
  title: string;
  subtitle: string;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, onMenuClick }) => (
  <div className="flex justify-between items-center px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-transparent relative z-20">
    <div className="flex items-center gap-2 sm:gap-3">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="打开历史对话"
        >
          <IconMenu className="text-gray-600 w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}
      <div className="flex items-baseline gap-1.5 sm:gap-2">
        <div className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 truncate">{title}</div>
        <div className="text-xs sm:text-sm text-gray-400 hidden sm:inline">{subtitle}</div>
      </div>
    </div>
  </div>
);

export default Header;
