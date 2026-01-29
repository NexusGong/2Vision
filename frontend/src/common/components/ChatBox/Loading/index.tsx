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
import classNames from "classnames";
import { IconImage } from "@arco-design/web-react/icon";
import "./index.css";

interface LoadingProps {
  className?: string;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ className, text }) => {
  return (
    <div
      className={classNames(
        "relative w-full aspect-video overflow-hidden rounded-2xl",
        className
      )}
      style={{
        background: 'linear-gradient(145deg, rgba(15, 15, 25, 0.95), rgba(20, 20, 35, 0.9))',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 212, 255, 0.1)',
      }}
    >
      {/* 背景网格 */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />
      
      {/* 科技感光晕 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="cyber-glow-orb cyber-glow-orb-1" />
        <div className="cyber-glow-orb cyber-glow-orb-2" />
      </div>
      
      {/* 扫描线效果 */}
      <div className="cyber-scan-line" />
      
      {/* 内容区域 */}
      <div className="h-full flex items-center justify-center flex-col relative z-20">
        {/* 旋转光环 */}
        <div className="relative mb-4">
          <div className="cyber-ring" />
          <div className="cyber-ring cyber-ring-reverse" />
          <div 
            className="w-16 h-16 flex items-center justify-center rounded-xl"
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)',
            }}
          >
            <IconImage 
              fontSize={28} 
              style={{ color: '#00d4ff' }}
            />
          </div>
        </div>
        
        {/* 加载文字（滚动提示） */}
        <div className="cyber-waiting-text mt-2">
          <div className="cyber-waiting-text-inner text-sm font-medium">
            {text || "图像内容较为复杂，生成过程可能需要一定时间，请耐心等待，期间请勿刷新或关闭页面"}
            <span className="cyber-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* 边角装饰 */}
      <div className="cyber-corner cyber-corner-tl" />
      <div className="cyber-corner cyber-corner-tr" />
      <div className="cyber-corner cyber-corner-bl" />
      <div className="cyber-corner cyber-corner-br" />
    </div>
  );
};
