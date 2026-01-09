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
              
              {/* 问候文本 */}
              <div className="relative text-center mb-7 font-semibold mx-auto text-[28px] leading-[36px] text-gray-800 cursor-default min-h-[36px] w-fit">
                我是古诗词古文图像化学习工具
              </div>
              <div className="relative text-center mb-7 font-semibold mx-auto text-[28px] leading-[36px] text-gray-800 cursor-default min-h-[36px] w-fit">
                有什么我能帮你的吗？
              </div>
              
              {/* 使用说明 - 横向三步流程 */}
              <div className="flex w-full justify-center mt-4">
                <div className="grid grid-cols-3 gap-3 max-w-[600px] w-full">
                  {/* 步骤1 */}
                  <div className="text-center group">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#576690] to-[#45527a] text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:scale-110 transition-transform">
                      1
                    </div>
                    <div className="text-sm font-medium text-[#2b2b2b] mb-0.5">输入诗词</div>
                    <div className="text-xs text-gray-400 leading-tight">粘贴古诗词或古文</div>
                  </div>
                  
                  {/* 步骤2 */}
                  <div className="text-center group">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#576690] to-[#45527a] text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:scale-110 transition-transform">
                      2
                    </div>
                    <div className="text-sm font-medium text-[#2b2b2b] mb-0.5">AI 分析</div>
                    <div className="text-xs text-gray-400 leading-tight">自动生成分镜脚本</div>
                  </div>
                  
                  {/* 步骤3 */}
                  <div className="text-center group">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#9d2933] to-[#7a2028] text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:scale-110 transition-transform">
                      3
                    </div>
                    <div className="text-sm font-medium text-[#2b2b2b] mb-0.5">生成内容</div>
                    <div className="text-xs text-gray-400 leading-tight">图像或视频，预览下载</div>
                  </div>
                </div>
              </div>
              
              {/* 模式提示 */}
              <div className="flex justify-center gap-4 mt-4 text-xs text-gray-400 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  故事书 · 课堂讲解
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  连环画 · 课前预习
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  视频 · 动态呈现
                </span>
              </div>
              
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
        "relative mb-9 max-w-[600px] overflow-hidden"
      )}
      onMouseEnter={() => {
        setIsShowRightSide(true);
      }}
      onMouseLeave={() => {
        setIsShowRightSide(false);
      }}
    >
      <div className="absolute top-5 left-5 z-10">{areaLeftTop}</div>
      {isShowRightSide && (
        <div className="absolute top-5 right-5">{areaRightSide}</div>
      )}
      <div className="mb-2 over">{children}</div>
      {onEditClick && (
        <div 
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#576690] cursor-pointer transition-colors w-fit mt-2 select-none"
            onClick={onEditClick}
        >
            <IconEdit />
            <span>重新编辑</span>
        </div>
      )}
    </div>
  );
};
