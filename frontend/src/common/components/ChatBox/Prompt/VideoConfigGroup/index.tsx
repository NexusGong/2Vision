/*
 * 视频配置组件 - 与图像配置风格统一
 */
import React from "react";
import { Form, Radio } from "@arco-design/web-react";
import { InputNumber } from "@arco-design/web-react";

export interface VideoConfigValue {
  duration: number;
  fps: number;
  aspectRatio: string;
}

const VideoConfigGroup: React.FC<{
  value?: VideoConfigValue;
  onChange?: (val: VideoConfigValue) => void;
}> = ({ value, onChange }) => {
  const current: VideoConfigValue = {
    duration: value?.duration ?? 15,
    fps: value?.fps ?? 24,
    aspectRatio: value?.aspectRatio ?? "16:9",
  };

  const durationOptions = [5, 10, 15, 20, 30, 45, 60];
  const fpsOptions = [24, 30, 60];
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
      <Form.Item className="w-full" field="videoDuration" label="视频时长（秒）" layout="vertical" initialValue={15}>
        <Radio.Group type="button" className="flex flex-wrap gap-1" value={current.duration} onChange={setDuration as any}>
          {durationOptions.map((d) => (
            <Radio
              className="flex-1 flex items-center justify-center h-[30px] min-w-[60px] [&.arco-radio-button]:!text-[#737373]"
              key={d}
              value={d}
            >
              {d}s
            </Radio>
          ))}
        </Radio.Group>
        <div className="mt-2">
          <InputNumber
            min={5}
            max={60}
            step={5}
            className="w-full"
            placeholder="自定义时长（5-60秒）"
            value={current.duration}
            onChange={(value: number | undefined) => {
              if (value && value >= 5 && value <= 60) {
                setDuration(value);
              }
            }}
          />
        </div>
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
