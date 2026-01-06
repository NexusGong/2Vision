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
              <div className="min-h-[224px] flex-1"></div>
              
              {/* 问候文本 */}
              <div className="relative text-center mb-7 font-semibold mx-auto text-[28px] leading-[36px] text-gray-800 cursor-default min-h-[36px] w-fit">
                我是古诗词古文图像化学习工具
              </div>
              <div className="relative text-center mb-7 font-semibold mx-auto text-[28px] leading-[36px] text-gray-800 cursor-default min-h-[36px] w-fit">
                有什么我能帮你的吗？
              </div>
              
              {/* 建议问题按钮区域 -> 替换为使用说明 */}
              <div className="flex w-full justify-center mt-4">
                <div className="max-w-[600px] w-full bg-white/40 backdrop-blur-sm border border-white/50 rounded-xl p-6 shadow-sm">
                  <div className="text-center mb-4 text-[#576690] font-semibold text-lg border-b border-[#576690]/20 pb-2 mx-10">
                    简单使用说明
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#2b2b2b]">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#576690]/10 text-[#576690] flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                      <div className="leading-relaxed">
                        <span className="font-medium text-[#576690]">输入内容：</span>
                        在底部输入框填写您想要生成的古诗词或古文故事内容。
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#576690]/10 text-[#576690] flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                      <div className="leading-relaxed">
                        <span className="font-medium text-[#576690]">选择模式：</span>
                        支持"故事书"（适合课堂讲解）和"连环画"（适合课前预习）两种模式。
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#576690]/10 text-[#576690] flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                      <div className="leading-relaxed">
                        <span className="font-medium text-[#576690]">生成图像：</span>
                        点击发送，AI将根据您的文本自动生成精美的古风插画。
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#576690]/10 text-[#576690] flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                      <div className="leading-relaxed">
                        <span className="font-medium text-[#576690]">查看与导出：</span>
                        生成完成后，可全屏查看、下载图片或进行打印分享。
                      </div>
                    </div>
                  </div>
                </div>
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
