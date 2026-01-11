/*
 * 视频生成等待动画组件
 * 古风韵味，显示进度、步骤和等待时间
 */
import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { IconVideoCamera } from "@arco-design/web-react/icon";
import "./index.css";

interface VideoLoadingProps {
  className?: string;
  progress?: number; // 0-100 的进度值
  status?: string; // 任务状态
  startTime?: number; // 开始时间戳
}

// 古风步骤描述
const videoSteps = [
  "研墨调色，准备画材",
  "笔走龙蛇，勾勒画面",
  "渲染着色，意境渐成",
  "装裱成卷，即将完成",
];

// 古风等待提示语（根据等待时间显示不同内容）
const waitingTips = [
  {
    time: 0,
    tips: [
      "好诗如好酒，需要时间酝酿",
      "慢工出细活，精品需等待",
      "匠心独运，正在为您精心制作",
    ],
  },
  {
    time: 30,
    tips: [
      "精雕细琢，方显匠心",
      "慢一点，是为了更完美",
      "美好的事物值得等待",
      "正在为您呈现最美的画面",
    ],
  },
  {
    time: 60,
    tips: [
      "千锤百炼，终成佳作",
      "耐心等待，精彩即将呈现",
      "每一帧都是精心雕琢",
      "即将完成，请稍候片刻",
    ],
  },
  {
    time: 120,
    tips: [
      "好事多磨，精彩在即",
      "最后的精雕细琢中",
      "即将为您呈现完整画卷",
      "请再稍候，马上就好",
    ],
  },
];

// 古风诗句（随机显示）
const poetryLines = [
  "山重水复疑无路，柳暗花明又一村",
  "欲穷千里目，更上一层楼",
  "宝剑锋从磨砺出，梅花香自苦寒来",
  "千淘万漉虽辛苦，吹尽狂沙始到金",
  "不经一番寒彻骨，怎得梅花扑鼻香",
  "路漫漫其修远兮，吾将上下而求索",
  "长风破浪会有时，直挂云帆济沧海",
  "会当凌绝顶，一览众山小",
];

export const VideoLoading: React.FC<VideoLoadingProps> = ({
  className,
  progress = 0,
  status = "processing",
  startTime,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTip, setCurrentTip] = useState("");
  const [currentPoetry, setCurrentPoetry] = useState("");

  // 根据进度计算当前步骤
  useEffect(() => {
    const stepIndex = Math.min(
      Math.floor((progress / 100) * videoSteps.length),
      videoSteps.length - 1
    );
    setCurrentStep(stepIndex);
  }, [progress]);

  // 计算已等待时间并更新提示语
  useEffect(() => {
    if (!startTime) return;

    const updateElapsedTime = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      // 根据等待时间选择提示语
      let selectedTips: string[] = [];
      for (let i = waitingTips.length - 1; i >= 0; i--) {
        if (elapsed >= waitingTips[i].time) {
          selectedTips = waitingTips[i].tips;
          break;
        }
      }
      
      if (selectedTips.length > 0) {
        // 随机选择一条提示语
        const randomTip = selectedTips[Math.floor(Math.random() * selectedTips.length)];
        setCurrentTip(randomTip);
      }
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // 随机选择诗句
  useEffect(() => {
    const randomPoetry = poetryLines[Math.floor(Math.random() * poetryLines.length)];
    setCurrentPoetry(randomPoetry);
    
    // 每15秒更换一次诗句
    const poetryInterval = setInterval(() => {
      const newPoetry = poetryLines[Math.floor(Math.random() * poetryLines.length)];
      setCurrentPoetry(newPoetry);
    }, 15000);

    return () => clearInterval(poetryInterval);
  }, []);

  // 格式化时间显示（古风表达）
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `已过${seconds}息`; // 古时一息约等于一呼一吸的时间
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) {
      return `已过${minutes}刻`; // 古时一刻约15分钟，这里借用表示分钟
    }
    if (secs < 10) {
      return `已过${minutes}刻余${secs}息`;
    }
    return `已过${minutes}刻${secs}息`;
  };

  // 根据状态获取提示文字（古风表达）
  const getStatusText = (): string => {
    if (status === "pending") return "静候佳音";
    if (status === "processing") return videoSteps[currentStep] || "正在制作";
    return "精心雕琢中";
  };

  return (
    <div className={classNames("video-loading", className)}>
      {/* 背景装饰 - 古风纹理 */}
      <div className="video-bg-pattern"></div>
      
      {/* 水墨涟漪动画 */}
      <div className="video-ink-ripple">
        <div className="video-ripple video-ripple-1" />
        <div className="video-ripple video-ripple-2" />
        <div className="video-ripple video-ripple-3" />
        <div className="video-ink-dot">
          <IconVideoCamera fontSize={20} style={{ color: "#576690" }} />
        </div>
      </div>

      {/* 主标题 - 古风表达 */}
      <div className="video-main-title">
        正在为您绘制画卷
      </div>

      {/* 步骤文字 */}
      <div className="video-step-text" key={currentStep}>
        {getStatusText()}
      </div>

      {/* 古风诗句 */}
      {currentPoetry && (
        <div className="video-poetry-line">
          {currentPoetry}
        </div>
      )}

      {/* 等待时间提示（古风表达） */}
      {elapsedTime > 0 && (
        <div className="video-time-hint">
          {formatTime(elapsedTime)}
        </div>
      )}

      {/* 古风温馨提示 */}
      {currentTip && elapsedTime > 10 && (
        <div className="video-tip">
          {currentTip}
        </div>
      )}
    </div>
  );
};

export default VideoLoading;
