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

import { IDataCoverItem } from "../types";
import "./cover.scss";
import { useImage } from "../../hooks/useImage";

/**
 * 封面组件
 * */
export const VsStoryBookPageCover = (data: IDataCoverItem) => {
  const { url, originalUrl, slot, coverRenderType = "image" } = data;
  const { status, src: currentSrc } = useImage(url || '', originalUrl);
  
  const imgNode = {
    image: (
      <img
        src={currentSrc}
        alt=""
        className="absolute w-full h-full object-cover"
      />
    ),
    background: (
      <div
        className="absolute w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url(${currentSrc})` }}
      />
    ),
  }[coverRenderType];
  
  // 封面只显示图片，不需要额外添加文本（图片本身已包含标题、朝代、作者等信息）
  return (
    <div className="vs-storybook__page-cover relative w-full h-full">
      {/* 基底 */}
      <div className="absolute w-full h-full vs-storybook__page-cover__base"></div>
      <div className="absolute w-full h-full vs-storybook__page-cover__texture"></div>

      {status === "error" ? null : imgNode}
      
      {/* 左侧阴影 */}
      <div className="absolute top-0 left-0 bottom-0 w-[7px] bg-[linear-gradient(270deg,_#00000014_0%,_#272727_61.46%)] opacity-[0.55] blur-[1px]"></div>
      <div className="absolute top-0 left-0 bottom-0 right-0 opacity-50 vs-storybook__page-cover__reflection"></div>
      {slot && <div className="absolute">{slot}</div>}
    </div>
  );
};
