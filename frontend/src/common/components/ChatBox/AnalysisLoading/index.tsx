/*
 * 诗词分析等待动画组件
 * 古典书卷风格的加载动画
 */

import React, { useState, useEffect } from "react";
import classNames from "classnames";
import "./index.css";

interface AnalysisLoadingProps {
  className?: string;
}

const analysisSteps = [
  { text: "识别诗词内容", icon: "📜" },
  { text: "查询作者与朝代", icon: "🏯" },
  { text: "分析创作背景", icon: "🎋" },
  { text: "解读诗词意境", icon: "🌙" },
  { text: "生成分镜脚本", icon: "🎨" },
];

export const AnalysisLoading: React.FC<AnalysisLoadingProps> = ({
  className,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dots, setDots] = useState("");

  // 步骤切换动画
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % analysisSteps.length);
    }, 2500);

    return () => clearInterval(stepInterval);
  }, []);

  // 省略号动画
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div
      className={classNames(
        "analysis-loading-container",
        className
      )}
    >
      {/* 背景装饰 */}
      <div className="analysis-loading-bg">
        <div className="ink-wash-bg"></div>
        <div className="floating-particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>

      {/* 主要内容 */}
      <div className="analysis-loading-content">
        {/* 书卷动画 */}
        <div className="scroll-animation">
          <div className="scroll-wrapper">
            <div className="scroll-left"></div>
            <div className="scroll-center">
              <div className="brush-stroke"></div>
            </div>
            <div className="scroll-right"></div>
          </div>
        </div>

        {/* 当前步骤 */}
        <div className="step-indicator">
          <span className="step-icon">{analysisSteps[currentStep].icon}</span>
          <span className="step-text">
            {analysisSteps[currentStep].text}
            <span className="step-dots">{dots}</span>
          </span>
        </div>

        {/* 进度点 */}
        <div className="progress-dots">
          {analysisSteps.map((_, index) => (
            <div
              key={index}
              className={classNames("progress-dot", {
                active: index === currentStep,
                completed: index < currentStep,
              })}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoading;

