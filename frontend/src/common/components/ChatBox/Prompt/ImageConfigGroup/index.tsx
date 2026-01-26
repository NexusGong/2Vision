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

import React, { useMemo } from "react";
import { Radio, Input } from "@arco-design/web-react";
import {
  Resolution,
  Ratio,
  GenImageResolutionRatio2WHMap,
} from "../const";
import lockSvg from "@/storybook-web/styles/assets/lock.svg";
import { RatioThumb } from "./RatioThumb";

export interface ImageSizeValue {
  resolution: Resolution;
  ratio: Ratio;
}

/**
 * 渲染分辨率与图片比例选择表单，使用 Arco Radio(type="button")。
 * 受控组件：通过 value/onChange 与外部 Form 联动。
 */
/**
 * 表单：分辨率 + 比例 + 尺寸展示
 */
const ImageConfigGroup: React.FC<{
  value?: ImageSizeValue;
  onChange?: (val: ImageSizeValue) => void;
  lockRatio?: Ratio;
}> = ({ value, onChange, lockRatio }) => {
  // 如果当前选择的是4K，回退到2K（因为已移除4K选项）
  const currentResolution = value?.resolution && value.resolution !== Resolution.Resolution_4K
    ? value.resolution
    : Resolution.Resolution_2K;
  
  const current: ImageSizeValue = {
    resolution: currentResolution,
    ratio: value?.ratio ?? Ratio.Ratio_9_16,
  };

  const resolutionOptions: Resolution[] = [
    Resolution.Resolution_2K,
  ];

  const ratioOptions: Ratio[] = [
    Ratio.Ratio_1_1,
    Ratio.Ratio_3_4,
    Ratio.Ratio_4_3,
    Ratio.Ratio_16_9,
    Ratio.Ratio_9_16,
    Ratio.Ratio_2_3,
    Ratio.Ratio_3_2,
    Ratio.Ratio_21_9,
  ];

  const wh =
    GenImageResolutionRatio2WHMap[current.resolution]?.[current.ratio] ||
    undefined;

  // 计算token消耗（统一成token消耗，与视频使用相同的token定价）
  // 图像生成总成本：1.21179元（文本分析0.01179元 + 图片生成1.2元）
  // 按照视频的token成本（0.0158元/1000 tokens）转换成等价tokens
  // 每个分镜等价tokens = 1.21179 / 0.0158 * 1000 = 76,685 tokens
  const estimatedTokens = useMemo(() => {
    // 图像生成等价tokens（与视频统一token定价）
    const totalTokens = 76685;
    return totalTokens;
  }, []);

  const setResolution = (r: Resolution) => {
    onChange?.({ resolution: r, ratio: current.ratio });
  };

  const setRatio = (ra: Ratio) => {
    onChange?.({ resolution: current.resolution, ratio: ra });
  };

  return (
    <div className="w-full mb-6">
      <div className="mb-4">
        <div className="text-white/70 text-sm mb-2">分辨率</div>
        <Radio.Group type="button" className="flex" value={current.resolution} onChange={setResolution as any}>
            {resolutionOptions.map((r) => (
            <Radio className="flex-1 flex items-center justify-center h-[30px]" key={r} value={r}>
                {r}
            </Radio>
            ))}
        </Radio.Group>
      </div>
      <div className="mb-4">
        <div className="text-white/70 text-sm mb-2">图片比例</div>
        <Radio.Group
          type="button"
          className="flex"
          value={lockRatio ?? current.ratio}
          disabled={Boolean(lockRatio)}
          onChange={setRatio as any}
        >
            {ratioOptions.map((ra) => (
            <Radio
                className="flex-1 flex items-center justify-center h-[60px] w-[20px]"
                key={ra}
                value={ra}
            >
                <div className="flex flex-col items-center gap-1">
                <RatioThumb ratio={ra} />
                <span className="text-xs">{ra}</span>
                </div>
            </Radio>
            ))}
        </Radio.Group>
      </div>
      <div className="mt-4 mb-2 text-white/80">图片尺寸</div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            disabled
            value={wh ? String(wh[0]) : ""}
            addBefore={<span className="px-2">W</span>}
          />
        </div>
        <img src={lockSvg} alt="lock" className="w-5 h-5 opacity-70" />
        <div className="flex-1">
          <Input
            disabled
            value={wh ? String(wh[1]) : ""}
            addBefore={<span className="px-2">H</span>}
          />
        </div>
      </div>

      {/* Token消耗提示 */}
      <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
        <div className="text-xs text-white/60 mb-1">预计消耗</div>
        <div className="text-base font-semibold text-cyan-400">
          {estimatedTokens.toLocaleString()} Tokens
        </div>
        <div className="text-xs text-white/50 mt-1">
          根据当前参数：{current.resolution} {current.ratio}
          {wh && ` (${wh[0]}×${wh[1]})`}
          <br />
          等价{estimatedTokens.toLocaleString()} tokens（统一token定价，与视频相同）
        </div>
      </div>
    </div>
  );
};

export default ImageConfigGroup;