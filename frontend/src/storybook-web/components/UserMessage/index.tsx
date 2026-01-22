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
import { type Message } from "@/common/components/ChatBox/Message";
import { formatDate, formatPromptData2Params } from "@/storybook-web/utils";
import { RatioThumb } from "@/common/components/ChatBox/Prompt/ImageConfigGroup/RatioThumb";
import { Ratio } from "@/common/components/ChatBox/Prompt/const";
import { Tooltip } from "@arco-design/web-react";
import { MODEL } from "@/storybook-web/consts";

interface UserMessageProps {
  message: Message;
}

const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={classNames(
        "max-h-[28px] px-3 flex items-center rounded-lg backdrop-blur-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs transition-all",
        className
      )}
      style={{
        background: 'rgba(0, 212, 255, 0.1)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        color: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      {children}
    </div>
  );
};

const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  const data = message.data as ReturnType<typeof formatPromptData2Params>;

  return (
    <div className="mb-6 flex flex-col items-end group ml-auto">
      <div className="flex items-center justify-end mb-1 px-1">
        <div className="text-[11px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDate(message.timestamp, "HH:mm")}
        </div>
      </div>

      {/* 用户消息气泡 - 科技风格 */}
      <div className="flex justify-end w-full">
        <div
          className={classNames(
            "rounded-2xl text-[15px] leading-[1.6]",
            "px-4 py-3 max-w-[450px] w-fit min-w-0 text-left",
            "transition-all duration-300"
          )}
          style={{ 
            whiteSpace: "pre-wrap", 
            wordBreak: "break-word",
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(177, 74, 237, 0.2))',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 212, 255, 0.1)',
          }}
          data-testid="message_text_content"
        >
          {data.query || ""}
        </div>
      </div>
    </div>
  );
};

export default UserMessage;
