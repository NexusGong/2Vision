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
        "max-h-[28px] px-3 flex items-center bg-white/50 text-gray-700 rounded-lg border border-white/60 backdrop-blur-sm shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs transition-colors hover:bg-white/70",
        className
      )}
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
        <div className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDate(message.timestamp, "HH:mm")}
        </div>
      </div>

      {/* 模仿豆包发送气泡样式：右对齐、固定最大宽度、自适应内容高度 */}
      <div className="flex justify-end w-full">
        <div
          className={classNames(
            // 容器：圆角气泡、浅底色、次要文字颜色、最大宽度 450，自适应宽度
            "bg-white rounded-2xl text-gray-800 text-[15px] leading-[1.6]",
            "px-4 py-2 max-w-[450px] w-fit min-w-0 text-left",
            // 与示例一致：不加额外效果，由外层阴影/背景控制整体风格
            "!text-[length:var(--message-send-text-content-font-size,15px)]"
          )}
          // 文本：正常自动换行 + 保留用户回车产生的换行
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          data-testid="message_text_content"
        >
          {data.query || ""}
        </div>
      </div>
    </div>
  );
};

export default UserMessage;
