/*
 * 视频生成等待动画组件
 * 科技风格 - 波形进度条 + 数字动画
 */
import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { IconVideoCamera } from "@arco-design/web-react/icon";
import "./index.css";

interface VideoLoadingProps {
  className?: string;
  progress?: number;
  status?: string;
  startTime?: number;
}

const cyberTips = [
  "内容结构较为复杂，正在根据诗意精细生成视频画面，请耐心等待，期间请勿刷新或关闭页面",
  "正在逐帧渲染古典人物与场景，保证人物形象和运镜前后一致，请耐心等待",
  "为避免违和的现代元素，系统正在严格对齐时代背景和意境，生成时间可能稍长，请耐心等待",
  "正在完成最后的细节优化与音画同步，稍后将为您呈现完整的视频效果",
];

export const VideoLoading: React.FC<VideoLoadingProps> = ({
  className,
  progress = 0,
  status = "processing",
  startTime,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTip, setCurrentTip] = useState(cyberTips[0]);

  useEffect(() => {
    if (!startTime) return;

    const updateElapsedTime = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      const tipIndex = Math.min(Math.floor(elapsed / 30), cyberTips.length - 1);
      setCurrentTip(cyberTips[tipIndex]);
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={classNames("cyber-video-loading", className)}>
      {/* 背景效果 */}
      <div className="cyber-video-grid" />
      <div className="cyber-video-glow cyber-video-glow-1" />
      <div className="cyber-video-glow cyber-video-glow-2" />
      
      {/* 扫描线 */}
      <div className="cyber-video-scan" />
      
      {/* 主体内容 */}
      <div className="cyber-video-content">
        {/* 视频图标动画 */}
        <div className="cyber-video-icon-container">
          <div className="cyber-video-ring" />
          <div className="cyber-video-ring cyber-video-ring-2" />
          <div className="cyber-video-icon">
            <IconVideoCamera fontSize={24} />
          </div>
        </div>

        {/* 滚动提示文字 */}
        <div className="cyber-video-waiting-text">
          <div className="cyber-video-waiting-inner">
            {currentTip}
          </div>
        </div>

        {/* 时间和提示 */}
        <div className="cyber-video-info">
          <span className="cyber-video-time">
            <span className="time-label">ELAPSED</span>
            <span className="time-value">{formatTime(elapsedTime)}</span>
          </span>
        </div>
      </div>

      {/* 边角装饰 */}
      <div className="cyber-video-corner cyber-video-corner-tl" />
      <div className="cyber-video-corner cyber-video-corner-tr" />
      <div className="cyber-video-corner cyber-video-corner-bl" />
      <div className="cyber-video-corner cyber-video-corner-br" />
    </div>
  );
};

export default VideoLoading;
