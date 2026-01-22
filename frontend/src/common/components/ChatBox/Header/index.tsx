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
          className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors group"
          aria-label="打开历史对话"
        >
          <IconMenu className="text-white/60 group-hover:text-cyan-400 w-5 h-5 sm:w-6 sm:h-6 transition-colors" />
        </button>
      )}
      <div className="flex items-baseline gap-1.5 sm:gap-2">
        {/* Logo 带霓虹光晕效果 */}
        <div className="relative">
          <div className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent truncate">
            {title}
          </div>
          {/* 发光效果层 */}
          <div 
            className="absolute inset-0 text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent truncate blur-sm opacity-50 pointer-events-none"
            aria-hidden="true"
          >
            {title}
          </div>
        </div>
        <div className="text-xs sm:text-sm text-white/40 hidden sm:inline font-mono">
          {subtitle}
        </div>
      </div>
    </div>
    
    {/* 底部渐变分割线 */}
    <div 
      className="absolute bottom-0 left-0 right-0 h-[1px]"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), rgba(177, 74, 237, 0.3), transparent)',
      }}
    />
  </div>
);

export default Header;
