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

import React, { useEffect, useState } from "react";
import classNames from "classnames";
import {
  Form,
  Upload,
  Input,
  InputNumber,
  Button,
  Select,
  Popover,
  Badge,
  Tooltip,
} from "@arco-design/web-react";
import { IconSettings, IconImage, IconPlayArrow } from "@arco-design/web-react/icon";
import { useIsMobile } from "@/common/components/StoryBook/hooks/useMobile";
import { useUser } from "@/storybook-web/contexts/UserContext";
import { getOrCreateSessionId } from "@/storybook-web/apis/auth";
import { fileToBase64 } from "./utils";
import {
  SupportImageFileTypes,
  Resolution,
  Ratio,
  GenImageResolutionRatio2WHMap,
} from "./const";
import ImageConfigGroup from "./ImageConfigGroup";
import VideoConfigGroup from "./VideoConfigGroup";
import styles from "./index.module.less";
import { RatioThumb } from "./ImageConfigGroup/RatioThumb";

export interface PromptData {
  images?: string[];
  text?: string;
  generationType?: "image" | "video";
  mode?: "storybook" | "comics";
  ratio?: string;
  resolution?: string;
  size?: string;
  // 视频相关参数
  videoDuration?: number; // 视频时长（秒），只支持 5 或 12
  videoResolution?: "720p" | "1080p"; // 视频清晰度：720p 或 1080p
  videoAspectRatio?: string; // 视频宽高比
}

export interface PromptProps {
  data?: PromptData;
  onSubmit?: (value: PromptData) => void;
}

const modes = [
  {
    key: "storybook",
    label: "故事书",
    description: "生成古诗词/古文故事书，适合课堂讲解",
  },
  {
    key: "comics",
    label: "连环画",
    description: "生成古诗词/古文连环画，适合课前预习",
  },
] as const;

const Prompt: React.FC<PromptProps> = ({ data, onSubmit }) => {
  const [form] = Form.useForm<PromptData>();
  const isMobile = useIsMobile(768);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const { user, usageStats, isAuthenticated, refreshUser } = useUser();
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const generationType = Form.useWatch("generationType", form as any) as "image" | "video" | undefined;
  const ratioValue = Form.useWatch("ratio", form as any) as Ratio;
  const resolutionValue = Form.useWatch(
    "resolution",
    form as any
  ) as Resolution;
  const modeValue = Form.useWatch("mode", form as any) as
    | "storybook"
    | "comics";
  const textValue = Form.useWatch("text", form as any) as string;
  const imagesValue = Form.useWatch("images", form as any);
  const videoDuration = Form.useWatch("videoDuration", form as any) as number | undefined;
  const videoResolution = Form.useWatch("videoResolution", form as any) as "720p" | "1080p" | undefined;
  const videoAspectRatio = Form.useWatch("videoAspectRatio", form as any) as string | undefined;

  const handleSubmit = async () => {
    const result = form.getFieldsValue();
    form.setFieldValue("text", "");
    form.setFieldValue("images", []);
    onSubmit?.(result);
    
    // 提交后更新剩余token（后端会自动扣除，这里只需要刷新）
    if (isAuthenticated && user) {
      // 登录用户：刷新用户信息（后端会更新免费token余额）
      await refreshUser();
    } else {
      // 匿名用户：更新已使用的token（估算）
      const sessionId = localStorage.getItem("session_id");
      if (sessionId) {
        // 根据生成类型估算token消耗
        let estimatedTokens = 0;
        if (generationType === "video") {
          // 视频生成：根据参数计算（默认720p 12秒 = 263,193 tokens）
          const duration = videoDuration || 12;
          const resolution = videoResolution || "720p";
          // 简化计算：720p 12秒 = 263,193 tokens，1080p 12秒 = 597,197 tokens
          if (resolution === "1080p") {
            estimatedTokens = duration === 5 ? 243000 + 3993 : 597197 + 3993;
          } else {
            estimatedTokens = duration === 5 ? 108000 + 3993 : 263193 + 3993;
          }
        } else {
          // 图像生成：76,685 tokens/分镜
          estimatedTokens = 76685;
        }
        const usedTokens = parseInt(localStorage.getItem(`used_tokens_${sessionId}`) || "0", 10);
        localStorage.setItem(`used_tokens_${sessionId}`, String(usedTokens + estimatedTokens));
        const ANONYMOUS_FREE_TOKENS = 494000; // 统一免费token（保证3次图像 + 1次视频）
        setRemainingCount(Math.max(0, ANONYMOUS_FREE_TOKENS - usedTokens - estimatedTokens));
      }
    }
  };

  useEffect(() => {
    // 只在图像模式下计算 size
    if (generationType === "image") {
      const sizeArray =
        GenImageResolutionRatio2WHMap[resolutionValue]?.[ratioValue];
      // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"，如 "1440x2560"
      form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
    }
  }, [ratioValue, resolutionValue, generationType]);

  useEffect(() => {
    // 当生成类型为图像时，才应用模式相关的设置
    if (generationType === "image" && modeValue === "storybook") {
      form.setFieldValue("ratio", Ratio.Ratio_9_16);
      const sizeArray =
        GenImageResolutionRatio2WHMap[resolutionValue]?.[Ratio.Ratio_9_16];
      // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"
      form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
    }
    // 当切换到视频时，设置默认值
    // 默认720p 12秒（基于定价策略）
    if (generationType === "video") {
      if (!form.getFieldValue("videoDuration")) {
        form.setFieldValue("videoDuration", 12); // 默认12秒
      }
      if (!form.getFieldValue("videoResolution")) {
        form.setFieldValue("videoResolution", "720p"); // 默认720p
      }
      if (!form.getFieldValue("videoAspectRatio")) {
        form.setFieldValue("videoAspectRatio", "16:9");
      }
      if (!form.getFieldValue("videoResolution")) {
        form.setFieldValue("videoResolution", "720p"); // 默认720p
      }
    }
  }, [modeValue, generationType]);

  useEffect(() => {
    data && form.setFieldsValue(data || {});
  }, [data]);

  // 更新剩余统一token显示
  useEffect(() => {
    if (isAuthenticated && user) {
      // 登录用户：获取统一token余额（免费token + 付费token余额）
      const remainingTokens = (user.free_tokens || 0) + (user.token_balance || 0);
      // 总量 = 剩余 + 已使用
      const totalTokens = remainingTokens + (user.total_token_used || 0);
      setRemainingCount(remainingTokens);
      setTotalCount(totalTokens);
    } else {
      // 匿名用户：计算已使用的token（从localStorage获取）
      const sessionId = localStorage.getItem("session_id");
      if (sessionId) {
        const usedTokens = parseInt(localStorage.getItem(`used_tokens_${sessionId}`) || "0", 10);
        // 匿名用户统一免费token额度：494,000 tokens（保证3次图像 + 1次视频）
        const ANONYMOUS_FREE_TOKENS = 494000;
        setRemainingCount(Math.max(0, ANONYMOUS_FREE_TOKENS - usedTokens));
        setTotalCount(ANONYMOUS_FREE_TOKENS);
      } else {
        const ANONYMOUS_FREE_TOKENS = 494000;
        setRemainingCount(ANONYMOUS_FREE_TOKENS);
        setTotalCount(ANONYMOUS_FREE_TOKENS);
      }
    }
  }, [isAuthenticated, user, usageStats]);

  return (
    <Form
      form={form}
      className={classNames(
        "m-auto pt-3 sm:pt-4 px-3 sm:px-4 pb-2 max-w-[800px] w-full",
        styles.sender
      )}
      onSubmit={handleSubmit}
    >
      {/* 输入框区域 - 与发送按钮同行 */}
      <div className="flex items-end gap-3 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <Form.Item className="w-full !mb-0" field="text">
            <Input.TextArea
              className="text-base !border-none !outline-none focus:!shadow-none !text-white/90 resize-none !bg-transparent !p-0 leading-relaxed placeholder:!text-white/40"
              style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
              autoSize={{ minRows: 1, maxRows: 8 }}
              placeholder="输入您的内容..."
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </Form.Item>
          
          {imagesValue?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Form.Item
                className="!mb-0"
                field="images"
                triggerPropName="fileList"
              >
                <Upload
                  listType="picture-card"
                  imagePreview
                  multiple
                  limit={10}
                  accept={{
                    type: SupportImageFileTypes.map((t) => `.${t}`).join(","),
                    strict: false,
                  }}
                  onChange={() => {}}
                  customRequest={async ({ file, onSuccess, onError }) => {
                    try {
                      onSuccess({
                        url: URL.createObjectURL(file),
                        base64: await fileToBase64(file),
                        name: file.name,
                      });
                    } catch (e: any) {
                      onError(e);
                    }
                  }}
                />
              </Form.Item>
            </div>
          )}
        </div>
        
        {/* 右侧：剩余次数 + 发送按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
          <Tooltip
            content={(() => {
              // 计算约等于图像/视频次数（向下取整）
              const IMAGE_TOKENS_PER_GENERATION = 76685; // 图像生成：76,685 tokens/次
              const VIDEO_TOKENS_720P_12S = 263193; // 视频生成：720p 12秒 = 263,193 tokens
              const VIDEO_TOKENS_1080P_12S = 597197; // 视频生成：1080p 12秒 = 597,197 tokens
              
              // 计算可以生成的次数（向下取整）
              const imageCount = Math.floor(remainingCount / IMAGE_TOKENS_PER_GENERATION);
              
              // 根据当前选择的视频参数计算视频次数
              let videoCount = 0;
              let videoDesc = "";
              if (generationType === "video") {
                const duration = videoDuration || 12;
                const resolution = videoResolution || "720p";
                if (resolution === "1080p") {
                  const tokensPerVideo = duration === 5 ? 243000 + 3993 : VIDEO_TOKENS_1080P_12S + 3993;
                  videoCount = Math.floor(remainingCount / tokensPerVideo);
                  videoDesc = `${resolution} ${duration}秒`;
                } else {
                  const tokensPerVideo = duration === 5 ? 108000 + 3993 : VIDEO_TOKENS_720P_12S + 3993;
                  videoCount = Math.floor(remainingCount / tokensPerVideo);
                  videoDesc = `${resolution} ${duration}秒`;
                }
              } else {
                // 图像模式，显示720p 12秒的视频次数
                videoCount = Math.floor(remainingCount / VIDEO_TOKENS_720P_12S);
                videoDesc = "720p 12秒";
              }
              
              // 图像：x次(约x张)，视频：x次（x清晰度 x秒）
              const imageDesc = `图像：${imageCount}次(约${imageCount * 5}张)`;
              const videoDescText = `视频：${videoCount}次（${videoDesc}）`;
              
              if (isAuthenticated) {
                return `剩余 ${remainingCount.toLocaleString()} tokens（${imageDesc}，${videoDescText}）`;
              } else {
                return `剩余 ${remainingCount.toLocaleString()} tokens（${imageDesc}，${videoDescText}），登录后可获得更多免费Tokens`;
              }
            })()}
          >
            <Badge
              status={
                remainingCount <= 0
                  ? "error"
                  : remainingCount <= 76685  // 少于1次图像生成
                  ? "warning"
                  : "success"
              }
              text={`${(remainingCount / 1000).toFixed(0)}K/${(totalCount / 1000).toFixed(0)}K`}
              style={{ cursor: "pointer" }}
            />
          </Tooltip>
          
          <Form.Item className="!mb-0">
            <Button
              type="primary"
              className={classNames(
                  `rounded-full ${isMobile ? 'w-8 h-8' : 'w-9 h-9'} !p-0 flex items-center justify-center transition-all duration-300 !border-none`,
                  textValue 
                    ? "!bg-gradient-to-r !from-cyan-500 !to-purple-500 text-white hover:shadow-[0_0_20px_rgba(0,212,255,0.5)] active:scale-95" 
                    : "!bg-white/10 !text-white/30 cursor-not-allowed"
              )}
              htmlType="submit"
              disabled={(() => {
                if (!textValue) return true;
                // 根据生成类型检查token是否足够
                if (generationType === "video") {
                  const duration = videoDuration || 12;
                  const resolution = videoResolution || "720p";
                  let requiredTokens = 0;
                  if (resolution === "1080p") {
                    requiredTokens = duration === 5 ? 243000 + 3993 : 597197 + 3993;
                  } else {
                    requiredTokens = duration === 5 ? 108000 + 3993 : 263193 + 3993;
                  }
                  return remainingCount < requiredTokens;
                } else {
                  // 图像生成：76,685 tokens/分镜
                  return remainingCount < 76685;
                }
              })()}
            >
              <svg width={isMobile ? "16" : "18"} height={isMobile ? "16" : "18"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </Form.Item>
        </div>
      </div>

      {/* 工具栏区域 */}
      <div className={`flex items-center px-3 pb-2 pt-1 border-t border-white/5 ${isMobile ? 'gap-1' : 'gap-2'}`}>
          {/* 上传按钮 */}
          <div className="relative flex-shrink-0">
             {/* 隐藏实际的 Upload 组件，只保留逻辑，或者将 Upload 按钮移到这里 */}
            <div className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 cursor-pointer text-white/70 hover:text-cyan-400 transition-colors`} onClick={() => {
                // 触发上传逻辑，这里简化处理，实际需要与 Form.Item 联动或使用 ref
                const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                uploadInput?.click();
            }}>
                <div className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center border-2 border-current rounded-full text-xs font-bold relative top-[1px]`}>
                   <span className="relative -top-[1px]">+</span>
                </div>
            </div>
            {/* 隐藏的 Upload 组件用于承载文件选择 */}
            <div className="hidden">
                 <Form.Item
                  field="images"
                  triggerPropName="fileList"
                 >
                   <Upload
                     multiple
                     accept={{
                       type: SupportImageFileTypes.map((t) => `.${t}`).join(","),
                       strict: false,
                     }}
                     customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          onSuccess({
                            url: URL.createObjectURL(file),
                            base64: await fileToBase64(file),
                            name: file.name,
                          });
                        } catch (e: any) {
                          onError(e);
                        }
                      }}
                   />
                 </Form.Item>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-white/10 mx-1 flex-shrink-0"></div>

          {/* 生成类型选择器 */}
          <Form.Item
            field="generationType"
            initialValue="image"
            className="!mb-0"
          >
            <Select
              placeholder="生成类型"
              allowClear={false}
              bordered={false}
              triggerProps={{
                autoAlignPopupWidth: false,
                position: "bl",
              }}
              className={`!bg-white/5 !border-none !px-2 hover:bg-white/10 rounded-lg !text-white/80 text-sm font-medium transition-colors ${isMobile ? 'h-7 min-w-[100px]' : 'h-8 min-w-[120px]'}`}
              renderFormat={(_, value) => {
                return (
                  <span className="flex items-center gap-1.5 font-medium whitespace-nowrap text-white/80">
                    {value === "video" ? (
                      <IconPlayArrow className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
                    ) : (
                      <IconImage className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
                    )}
                    {value === "video" ? "视频" : "图像"}
                  </span>
                );
              }}
            >
              <Select.Option value="image">
                <div className="flex items-center gap-2">
                  <IconImage className="w-4 h-4" />
                  <span>生成图像</span>
                </div>
              </Select.Option>
              <Select.Option value="video">
                <div className="flex items-center gap-2">
                  <IconPlayArrow className="w-4 h-4" />
                  <span>生成视频</span>
                </div>
              </Select.Option>
            </Select>
          </Form.Item>

          <div className="h-4 w-[1px] bg-white/10 mx-1 flex-shrink-0"></div>

          {/* 根据生成类型显示不同的配置 */}
          {generationType === "video" ? (
            /* 视频配置 - 与图像配置风格统一 */
            <>
              {/* 移动端：简化的设置按钮 */}
              {isMobile ? (
                <Popover
                  trigger="click"
                  position="top"
                  className="!w-[calc(100vw-32px)] !max-w-[360px]"
                  content={
                    <div className="p-3">
                  <VideoConfigGroup
                      value={{
                        duration: videoDuration ?? 12,
                        resolution: (videoResolution || "720p") as "720p" | "1080p",
                        aspectRatio: videoAspectRatio || "16:9",
                      }}
                      onChange={(val) => {
                        form.setFieldValue("videoDuration", val.duration);
                        form.setFieldValue("videoResolution", val.resolution);
                        form.setFieldValue("videoAspectRatio", val.aspectRatio);
                      }}
                    />
                    </div>
                  }
                >
                  <div className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 cursor-pointer text-white/70 text-xs transition-colors font-medium">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-cyan-400"></span>
                    <span className="truncate">视频配置</span>
                    <IconSettings className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />
                  </div>
                </Popover>
              ) : (
                /* 桌面端：完整工具栏 - 与图像配置风格统一 */
                <Popover
                  trigger="click"
                  className="min-w-[410px]"
                  content={
                    <VideoConfigGroup
                      value={{
                        duration: videoDuration ?? 12,
                        resolution: (videoResolution || "720p") as "720p" | "1080p",
                        aspectRatio: videoAspectRatio || "16:9",
                      }}
                      onChange={(val) => {
                        form.setFieldValue("videoDuration", val.duration);
                        form.setFieldValue("videoResolution", val.resolution);
                        form.setFieldValue("videoAspectRatio", val.aspectRatio);
                      }}
                    />
                  }
                >
                  <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer text-white/80 text-sm transition-colors font-medium">
                    <div className="font-medium text-xs border border-cyan-400/50 text-cyan-400 rounded px-1">
                      {videoResolution || "720p"}
                    </div>
                    <div className="font-medium text-xs border border-cyan-400/50 text-cyan-400 rounded px-1">
                      {videoDuration ?? 12}s
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-white/60">{videoAspectRatio || "16:9"}</span>
                    </div>
                  </div>
                </Popover>
              )}
            </>
          ) : (
            /* 图像配置 */
            <>
              {/* 移动端：简化的设置按钮 */}
              {isMobile ? (
                <Popover
                  trigger="click"
                  position="top"
                  className="!w-[calc(100vw-32px)] !max-w-[360px]"
                  content={
                    <div className="p-3 space-y-4">
                      {/* 模式选择 */}
                      <div>
                        <div className="text-xs text-white/50 mb-2">生成模式</div>
                        <div className="flex gap-2">
                          {modes.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              className={classNames(
                                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                                modeValue === option.key 
                                  ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white" 
                                  : "bg-white/10 text-white/70 active:bg-white/20"
                              )}
                              onClick={() => form.setFieldValue("mode", option.key)}
                            >
                              <span className={classNames("w-2 h-2 rounded-full inline-block mr-1.5", option.key === 'storybook' ? 'bg-cyan-400' : 'bg-purple-400')}></span>
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* 图像配置 */}
                      <ImageConfigGroup
                        value={{
                          resolution: resolutionValue,
                          ratio: modeValue === "storybook" ? Ratio.Ratio_9_16 : ratioValue,
                        }}
                        lockRatio={modeValue === "storybook" ? Ratio.Ratio_9_16 : undefined}
                        onChange={(val) => {
                          form.setFieldValue("resolution", val.resolution);
                          form.setFieldValue("ratio", val.ratio);
                          const sizeArray = GenImageResolutionRatio2WHMap[val.resolution]?.[val.ratio];
                          form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
                        }}
                      />
                    </div>
                  }
                >
                  <div className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 cursor-pointer text-white/70 text-xs transition-colors font-medium">
                    <span className={classNames("w-1.5 h-1.5 rounded-full flex-shrink-0", modeValue === 'storybook' ? 'bg-cyan-400' : 'bg-purple-400')}></span>
                    <span className="truncate">{modes.find(m => m.key === modeValue)?.label}</span>
                    <IconSettings className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />
                  </div>
                </Popover>
              ) : (
                /* 桌面端：完整工具栏 */
                <div className="flex items-center gap-1">
                    <Form.Item
                      field="mode"
                      initialValue={"storybook"}
                      className="!mb-0"
                    >
                      <Select
                        placeholder="模式"
                        allowClear={false}
                        bordered={false}
                        triggerProps={{
                          autoAlignPopupWidth: false,
                          position: "bl",
                          className: "min-w-[120px]"
                        }}
                        className="!bg-white/5 !border-none !px-2 hover:bg-white/10 rounded-lg h-8 !text-white/80 text-sm font-medium transition-colors min-w-[120px]"
                        renderFormat={(_, value) => {
                          const option = modes.find((o) => o.key === value);
                          return (
                              <span className="flex items-center gap-1 font-medium whitespace-nowrap text-white/80">
                                  <span className={classNames("w-2 h-2 rounded-full flex-shrink-0", value === 'storybook' ? 'bg-cyan-400' : 'bg-purple-400')}></span>
                                  {option?.label}
                              </span>
                          );
                        }}
                      >
                        {modes.map((option) => (
                          <Select.Option value={option.key} key={option.key}>
                            <div>
                              <div className="text-[14px] font-medium">{option.label}</div>
                              <div className="text-[12px] text-white/50 mt-0.5">
                                {option.description}
                              </div>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Popover
                      trigger="click"
                      className="min-w-[410px]"
                      content={
                        <ImageConfigGroup
                          value={{
                            resolution: resolutionValue,
                            ratio:
                              modeValue === "storybook" ? Ratio.Ratio_9_16 : ratioValue,
                          }}
                          lockRatio={
                            modeValue === "storybook" ? Ratio.Ratio_9_16 : undefined
                          }
                          onChange={(val) => {
                            form.setFieldValue("resolution", val.resolution);
                            form.setFieldValue("ratio", val.ratio);
                            const sizeArray =
                              GenImageResolutionRatio2WHMap[val.resolution]?.[
                                val.ratio
                              ];
                            // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"
                            form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
                          }}
                        />
                      }
                    >
                      <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer text-white/80 text-sm transition-colors font-medium">
                        <div className="font-medium text-xs border border-cyan-400/50 text-cyan-400 rounded px-1">{resolutionValue || "2K"}</div>
                        <div className="flex items-center gap-1">
                           <span className="w-4 h-4 flex items-center justify-center text-white/70">
                              <RatioThumb
                                ratio={
                                  modeValue === "storybook"
                                    ? Ratio.Ratio_9_16
                                    : (ratioValue as Ratio) || Ratio.Ratio_1_1
                                }
                              />
                           </span>
                          <span className="text-xs text-white/60">
                            {modeValue === "storybook"
                              ? Ratio.Ratio_9_16
                              : ratioValue || Ratio.Ratio_1_1}
                          </span>
                        </div>
                      </div>
                    </Popover>
                </div>
              )}
            </>
          )}
          
           {/* 隐藏字段 */}
          <Form.Item field="ratio" initialValue={Ratio.Ratio_1_1} noStyle>
            <div></div>
          </Form.Item>
          <Form.Item
            field="resolution"
            initialValue={Resolution.Resolution_2K}
            noStyle
          >
            <div></div>
          </Form.Item>
          <Form.Item field="size" noStyle>
            <div></div>
          </Form.Item>
          
          {/* 移动端隐藏的模式选择 - 通过 Popover 控制 */}
          {isMobile && generationType === "image" && (
            <Form.Item field="mode" initialValue={"storybook"} noStyle>
              <div></div>
            </Form.Item>
          )}
          
          {/* 隐藏的生成类型字段 */}
          <Form.Item field="generationType" initialValue="image" noStyle>
            <div></div>
          </Form.Item>
          
          {/* 视频参数隐藏字段 */}
          {generationType === "video" && (
            <>
              <Form.Item field="videoDuration" initialValue={12} noStyle>
                <div></div>
              </Form.Item>
              <Form.Item field="videoResolution" initialValue="720p" noStyle>
                <div></div>
              </Form.Item>
              <Form.Item field="videoAspectRatio" initialValue="16:9" noStyle>
                <div></div>
              </Form.Item>
            </>
          )}
      </div>
    </Form>
  );
};

export default Prompt;
