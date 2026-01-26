/*
 * 视频配置组件 - 与图像配置风格统一
 * 参数选项基于 doubao-seedance-1-5-pro 模型实际支持的参数
 * API参考: backend/ark_client.py videos_create
 * 
 * doubao-seedance-1-5-pro 支持的 duration 配置：
 * - 指定具体时长：支持 [4,12] 范围内的任一整数
 * - 自动选择：设置为 -1，表示由模型在 [4,12] 范围内自主选择合适的视频长度
 */
import React from "react";
import { Radio } from "@arco-design/web-react";

export interface VideoConfigValue {
  duration: number; // 只支持 5 或 12 秒
  aspectRatio: string;
  resolution: "720p" | "1080p"; // 分辨率：720p 或 1080p
}

// 计算视频token消耗的函数
// 默认帧率：24 FPS
export const calculateVideoTokens = (
  resolution: "720p" | "1080p",
  duration: number,
  aspectRatio: string
): number => {
  const fps = 24; // 固定帧率24 FPS
  // 根据分辨率和宽高比确定宽高
  let width: number, height: number;
  
  if (resolution === "720p") {
    if (aspectRatio === "16:9" || aspectRatio === "9:16") {
      width = 1280;
      height = 720;
    } else if (aspectRatio === "4:3" || aspectRatio === "3:4") {
      width = 1112;
      height = 834;
    } else if (aspectRatio === "1:1") {
      width = 960;
      height = 960;
    } else if (aspectRatio === "21:9") {
      width = 1470;
      height = 630;
    } else {
      // 默认16:9
      width = 1280;
      height = 720;
    }
  } else {
    // 1080p
    if (aspectRatio === "16:9" || aspectRatio === "9:16") {
      width = 1920;
      height = 1080;
    } else if (aspectRatio === "4:3" || aspectRatio === "3:4") {
      width = 1664;
      height = 1248;
    } else if (aspectRatio === "1:1") {
      width = 1440;
      height = 1440;
    } else if (aspectRatio === "21:9") {
      width = 2205;
      height = 945;
    } else {
      // 默认16:9
      width = 1920;
      height = 1080;
    }
  }
  
  // 正常视频估算 token 用量公式: (宽 × 高 × 帧率 × 时长) / 1024
  const tokens = Math.ceil((width * height * fps * duration) / 1024);
  return tokens;
};

const VideoConfigGroup: React.FC<{
  value?: VideoConfigValue;
  onChange?: (val: VideoConfigValue) => void;
}> = ({ value, onChange }) => {
  const current: VideoConfigValue = {
    duration: value?.duration ?? 12, // 默认12秒
    aspectRatio: value?.aspectRatio ?? "16:9",
    resolution: value?.resolution ?? "720p", // 默认720p
  };

  // 只支持 5秒 和 12秒
  const durationOptions = [
    { value: 5, label: "5s" },
    { value: 12, label: "12s" },
  ];
  
  // 分辨率选项：720p 和 1080p
  const resolutionOptions = [
    { value: "720p" as const, label: "720p" },
    { value: "1080p" as const, label: "1080p" },
  ];
  
  // aspect_ratio: 支持 "16:9", "9:16", "1:1"
  const aspectRatioOptions = [
    { value: "16:9", label: "16:9 横屏" },
    { value: "9:16", label: "9:16 竖屏" },
    { value: "1:1", label: "1:1 方形" },
  ];

  // 计算当前配置的token消耗（统一token系统：视频生成 + 文本分析）
  const videoTokens = calculateVideoTokens(
    current.resolution,
    current.duration,
    current.aspectRatio
  );
  const textAnalysisTokens = 3993; // 文本分析tokens
  const estimatedTokens = videoTokens + textAnalysisTokens;

  const setDuration = (d: number) => {
    const newValue = { ...current, duration: d };
    onChange?.(newValue);
  };

  const setAspectRatio = (a: string) => {
    const newValue = { ...current, aspectRatio: a };
    onChange?.(newValue);
  };

  const setResolution = (r: "720p" | "1080p") => {
    const newValue = { ...current, resolution: r };
    onChange?.(newValue);
  };

  return (
    <div className="w-full mb-6">
      <div className="mb-4">
        <div className="text-white/70 text-sm mb-1">分辨率</div>
        <Radio.Group type="button" className="flex" value={current.resolution} onChange={setResolution as any}>
          {resolutionOptions.map((option) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      </div>

      <div className="mb-4">
        <div className="text-white/70 text-sm mb-1">视频时长</div>
        <Radio.Group type="button" className="flex" value={current.duration} onChange={setDuration as any}>
          {durationOptions.map((option) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      </div>

      <div className="mb-4">
        <div className="text-white/70 text-sm mb-2">视频比例</div>
        <Radio.Group type="button" className="flex" value={current.aspectRatio} onChange={setAspectRatio as any}>
          {aspectRatioOptions.map((option) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      </div>

      {/* Token消耗提示 */}
      <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
        <div className="text-xs text-white/60 mb-1">预计消耗</div>
        <div className="text-base font-semibold text-cyan-400">
          {estimatedTokens.toLocaleString()} Tokens
        </div>
        <div className="text-xs text-white/50 mt-1">
          根据当前参数：{current.resolution} {current.duration}秒 {current.aspectRatio}（帧率24 FPS）
          <br />
          包含文本分析{textAnalysisTokens.toLocaleString()} tokens + 视频生成{videoTokens.toLocaleString()} tokens
        </div>
      </div>
    </div>
  );
};

export default VideoConfigGroup;
