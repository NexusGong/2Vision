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

import React, { memo, ReactNode, useState } from "react";
import classNames from "classnames";
import { Button } from "@arco-design/web-react";
import { IconEdit } from "@arco-design/web-react/icon";
import { useUser } from "@/storybook-web/contexts/UserContext";

export interface Message {
  type: "user" | "assistant" | "analysis";
  status?: "loading" | "success" | "error" | "editing";
  id: string;
  data: any;
  parentId?: string;
  timestamp: number;
}

export interface MessageItemProps {
  message: Message;
  children: React.ReactNode | ((item: Message) => React.ReactNode);
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  children,
}) => {
  const content = typeof children === "function" ? children(message) : children;
  return <>{content}</>;
};

export const MemoizedMessageItem = memo(MessageItem) as typeof MessageItem;

export interface MessageListProps {
  className?: string;
  messages: Message[];
  children: (item: Message) => React.ReactNode;
  emptyBox?: React.ReactNode;
  onSuggestionClick?: (text: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  className,
  messages,
  children,
  emptyBox,
  onSuggestionClick,
}) => {
  const { user } = useUser();
  // 简单判断：有付费 token 余额视为“充值过的用户”
  const hasPaidTokens = !!user && (user.token_balance || 0) > 0;

  return (
    <div className={classNames(className, "flex flex-col w-full py-6")}>
      {messages?.length > 0 ? (
        messages.map((message, index) => (
          <MemoizedMessageItem key={index} message={message}>
            {children}
          </MemoizedMessageItem>
        ))
      ) : (
        <div className="flex w-full flex-grow flex-col items-center px-4 sm:px-8 md:px-16">
          {!emptyBox ? (
            <>
              {/* 顶部空白区域 */}
              <div className="min-h-[120px] flex-1"></div>
              
              {/* 问候文本 - 科技风渐变文字 */}
              <div className="relative text-center mb-5 font-bold mx-auto text-[28px] leading-[36px] cursor-default min-h-[36px] w-fit">
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
                  我是2Vision古诗词古文图像化学习工具
                </span>
              </div>
              <div className="relative text-center mb-7 font-semibold mx-auto text-[24px] leading-[32px] text-white/70 cursor-default min-h-[32px] w-fit">
                有什么我能帮你的吗？
              </div>
              
              {/* 使用说明 - 科技风横向三步流程 */}
              <div className="flex w-full justify-center mt-4">
                <div className="grid grid-cols-3 gap-4 max-w-[600px] w-full">
                  {/* 步骤1 */}
                  <div className="text-center group">
                    <div 
                      className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-base font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(177, 74, 237, 0.2))',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#00d4ff',
                        boxShadow: '0 0 15px rgba(0, 212, 255, 0.1)',
                      }}
                    >
                      1
                    </div>
                    <div className="text-sm font-medium text-white/90 mb-1">输入诗词</div>
                    <div className="text-xs text-white/40 leading-tight">粘贴古诗词或古文</div>
                  </div>
                  
                  {/* 步骤2 */}
                  <div className="text-center group">
                    <div 
                      className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-base font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(177,74,237,0.4)]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(177, 74, 237, 0.2), rgba(0, 212, 255, 0.2))',
                        border: '1px solid rgba(177, 74, 237, 0.3)',
                        color: '#b14aed',
                        boxShadow: '0 0 15px rgba(177, 74, 237, 0.1)',
                      }}
                    >
                      2
                    </div>
                    <div className="text-sm font-medium text-white/90 mb-1">AI 分析</div>
                    <div className="text-xs text-white/40 leading-tight">自动生成分镜脚本</div>
                  </div>
                  
                  {/* 步骤3 */}
                  <div className="text-center group">
                    <div 
                      className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-base font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,255,204,0.4)]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.2), rgba(0, 212, 255, 0.2))',
                        border: '1px solid rgba(0, 255, 204, 0.3)',
                        color: '#00ffcc',
                        boxShadow: '0 0 15px rgba(0, 255, 204, 0.1)',
                      }}
                    >
                      3
                    </div>
                    <div className="text-sm font-medium text-white/90 mb-1">生成内容</div>
                    <div className="text-xs text-white/40 leading-tight">图像或视频，预览下载</div>
                  </div>
                </div>
              </div>
              
              {/* 模式提示 - 科技风标签 */}
              <div className="flex justify-center gap-4 mt-6 text-xs flex-wrap">
                <span 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    color: 'rgba(0, 212, 255, 0.8)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,212,255,0.8)]"></span>
                  故事书 · 课堂讲解
                </span>
                <span 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{
                    background: 'rgba(177, 74, 237, 0.1)',
                    border: '1px solid rgba(177, 74, 237, 0.2)',
                    color: 'rgba(177, 74, 237, 0.8)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(177,74,237,0.8)]"></span>
                  连环画 · 课前预习
                </span>
                <span 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{
                    background: 'rgba(0, 255, 204, 0.1)',
                    border: '1px solid rgba(0, 255, 204, 0.2)',
                    color: 'rgba(0, 255, 204, 0.8)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(0,255,204,0.8)]"></span>
                  视频 · 动态呈现
                </span>
              </div>
              
              {/* 仅对充值过的用户显示的使用问题联系方式 */}
              {hasPaidTokens && (
                <div className="mt-4 text-xs text-white/50 text-center">
                  如有使用问题 请发邮件至 nexusme777@gmail.com
                </div>
              )}

              {/* 底部空白区域 */}
              <div className="min-h-[32px] flex-1"></div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export interface MessageCardProps {
  className?: string;
  areaLeftTop?: ReactNode;
  areaRightSide?: ReactNode;
  children: React.ReactNode;
  onEditClick?: () => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  className,
  areaLeftTop,
  areaRightSide,
  children,
  onEditClick,
}) => {
  const [isShowRightSide, setIsShowRightSide] = useState(false);

  return (
    <div
      className={classNames(
        className,
        "relative mb-9 max-w-[600px] overflow-hidden rounded-2xl transition-all duration-300"
      )}
      style={{
        background: 'linear-gradient(145deg, rgba(20, 20, 35, 0.8), rgba(15, 15, 25, 0.9))',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 212, 255, 0.05)',
      }}
      onMouseEnter={() => {
        setIsShowRightSide(true);
      }}
      onMouseLeave={() => {
        setIsShowRightSide(false);
      }}
    >
      {/* 顶部渐变线 */}
      <div 
        className="absolute top-0 left-[10%] right-[10%] h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.4), transparent)',
        }}
      />
      
      <div className="absolute top-5 left-5 z-10">{areaLeftTop}</div>
      {isShowRightSide && (
        <div className="absolute top-5 right-5">{areaRightSide}</div>
      )}
      <div className="mb-2 p-4">{children}</div>
      {onEditClick && (
        <div 
          className="flex items-center gap-1.5 text-xs cursor-pointer transition-all w-fit mx-4 mb-3 select-none px-2 py-1 rounded"
          style={{
            color: 'rgba(0, 212, 255, 0.6)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#00d4ff';
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(0, 212, 255, 0.6)';
            e.currentTarget.style.background = 'transparent';
          }}
          onClick={onEditClick}
        >
          <IconEdit />
          <span>重新编辑</span>
        </div>
      )}
    </div>
  );
};
