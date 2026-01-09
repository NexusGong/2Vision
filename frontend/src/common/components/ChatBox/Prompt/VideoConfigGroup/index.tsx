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
import { Form, Radio } from "@arco-design/web-react";

export interface VideoConfigValue {
  duration: number; // 支持 [4,12] 范围内的整数，或 -1（自动选择）
  fps: number;
  aspectRatio: string;
}

const VideoConfigGroup: React.FC<{
  value?: VideoConfigValue;
  onChange?: (val: VideoConfigValue) => void;
}> = ({ value, onChange }) => {
  const current: VideoConfigValue = {
    duration: value?.duration ?? -1, // 默认自动选择
    fps: value?.fps ?? 24,
    aspectRatio: value?.aspectRatio ?? "16:9",
  };

  // doubao-seedance-1-5-pro 模型实际支持的参数选项
  // duration: 支持 [4,12] 范围内的整数，或 -1（自动选择）
  const durationOptions = [
    { value: -1, label: "自动" },
    { value: 4, label: "4s" },
    { value: 5, label: "5s" },
    { value: 6, label: "6s" },
    { value: 7, label: "7s" },
    { value: 8, label: "8s" },
    { value: 9, label: "9s" },
    { value: 10, label: "10s" },
    { value: 11, label: "11s" },
    { value: 12, label: "12s" },
  ];
  // fps: 支持 24, 30, 60
  const fpsOptions = [24, 30, 60];
  // aspect_ratio: 支持 "16:9", "9:16", "1:1"
  const aspectRatioOptions = [
    { value: "16:9", label: "16:9 横屏" },
    { value: "9:16", label: "9:16 竖屏" },
    { value: "1:1", label: "1:1 方形" },
  ];

  const setDuration = (d: number) => {
    onChange?.({ ...current, duration: d });
  };

  const setFps = (f: number) => {
    onChange?.({ ...current, fps: f });
  };

  const setAspectRatio = (a: string) => {
    onChange?.({ ...current, aspectRatio: a });
  };

  return (
    <div className="w-full mb-6">
      <Form.Item className="w-full" field="videoDuration" label="视频时长" layout="vertical" initialValue={-1}>
        <div className="text-xs text-gray-500 mb-2">
          指定具体时长（4-12秒）或自动选择（-1）。注意视频时长与计费相关，请谨慎设置。
        </div>
        <Radio.Group type="button" className="flex flex-wrap gap-1" value={current.duration} onChange={setDuration as any}>
          {durationOptions.map((option) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px] min-w-[60px] [&.arco-radio-button]:!text-[#737373]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item className="w-full" field="videoFps" label="帧率（FPS）" layout="vertical" initialValue={24}>
        <Radio.Group type="button" className="flex" value={current.fps} onChange={setFps as any}>
          {fpsOptions.map((f) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px] [&.arco-radio-button]:!text-[#737373]"
              key={f}
              value={f}
            >
              {f} FPS
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item className="w-full" field="videoAspectRatio" label="视频比例" layout="vertical" initialValue="16:9">
        <Radio.Group type="button" className="flex" value={current.aspectRatio} onChange={setAspectRatio as any}>
          {aspectRatioOptions.map((option) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px] [&.arco-radio-button]:!text-[#737373]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>
    </div>
  );
};

export default VideoConfigGroup;
