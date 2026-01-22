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

const videoSteps = [
  "初始化渲染引擎",
  "分析场景构图",
  "合成动态帧",
  "输出高清视频",
];

const cyberTips = [
  "AI 正在为您创作中",
  "精心渲染每一帧画面",
  "即将完成，请稍候",
  "最后的优化处理中",
];

export const VideoLoading: React.FC<VideoLoadingProps> = ({
  className,
  progress = 0,
  status = "processing",
  startTime,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTip, setCurrentTip] = useState(cyberTips[0]);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const stepIndex = Math.min(
      Math.floor((progress / 100) * videoSteps.length),
      videoSteps.length - 1
    );
    setCurrentStep(stepIndex);
  }, [progress]);

  // 平滑进度动画
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev < progress) {
          return Math.min(prev + 1, progress);
        }
        return prev;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [progress]);

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

        {/* 进度数字 */}
        <div className="cyber-video-progress-number">
          <span className="progress-value">{displayProgress}</span>
          <span className="progress-percent">%</span>
        </div>

        {/* 状态文字 */}
        <div className="cyber-video-status" key={currentStep}>
          <span className="status-bracket">[</span>
          {videoSteps[currentStep]}
          <span className="status-bracket">]</span>
        </div>

        {/* 波形进度条 */}
        <div className="cyber-video-wave-container">
          <div className="cyber-video-wave">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className="wave-bar"
                style={{ 
                  animationDelay: `${i * 0.1}s`,
                  opacity: i < (displayProgress / 100) * 20 ? 1 : 0.2,
                }}
              />
            ))}
          </div>
        </div>

        {/* 时间和提示 */}
        <div className="cyber-video-info">
          <span className="cyber-video-time">
            <span className="time-label">ELAPSED</span>
            <span className="time-value">{formatTime(elapsedTime)}</span>
          </span>
          {elapsedTime > 5 && (
            <span className="cyber-video-tip">{currentTip}</span>
          )}
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
