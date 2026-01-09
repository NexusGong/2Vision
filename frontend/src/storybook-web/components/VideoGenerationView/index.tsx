/*
 * 视频查看模态框
 */
import React from "react";
import { Modal } from "@arco-design/web-react";
import { useIsMobile } from "@/common/components/StoryBook/hooks/useMobile";
import { IconDownload, IconFullscreen } from "@arco-design/web-react/icon";
import { downloadVideo } from "../../utils";

interface VideoViewModalProps {
  visible?: boolean;
  videoUrl: string;
  title?: string;
  onClose?: () => void;
}

export const VideoViewModal: React.FC<VideoViewModalProps> = ({
  visible,
  videoUrl,
  title,
  onClose,
}) => {
  const isMobile = useIsMobile(768);

  const handleClose = () => {
    onClose?.();
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) return;
    
    try {
      await downloadVideo(videoUrl, title || "generated-video");
    } catch (error: any) {
      console.error("下载视频失败:", error);
    }
  };

  const handleFullscreen = () => {
    const video = document.querySelector('.video-view-modal video') as HTMLVideoElement;
    if (video) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen();
      } else if ((video as any).mozRequestFullScreen) {
        (video as any).mozRequestFullScreen();
      } else if ((video as any).msRequestFullscreen) {
        (video as any).msRequestFullscreen();
      }
    }
  };

  if (!videoUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      mask={true}
      footer={null}
      closable={true}
      onCancel={handleClose}
      className="video-view-modal"
      style={{
        zIndex: 2000,
        maxWidth: "90vw",
        width: isMobile ? "100vw" : "80vw",
        padding: 0,
      }}
    >
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        {/* 视频播放器 */}
        <div className="relative group">
          <video
            controls
            className="w-full"
            src={videoUrl}
            style={{ maxHeight: isMobile ? "70vh" : "80vh" }}
            controlsList="nodownload"
            autoPlay
          >
            您的浏览器不支持视频播放
          </video>
          
          {/* 视频操作按钮 */}
          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={handleDownloadVideo}
              className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              title="下载视频"
            >
              <IconDownload fontSize={16} />
              {!isMobile && "下载"}
            </button>
            <button
              onClick={handleFullscreen}
              className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              title="全屏播放"
            >
              <IconFullscreen fontSize={16} />
              {!isMobile && "全屏"}
            </button>
          </div>
        </div>
        
        {/* 标题 */}
        {title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <h3 className="text-white text-lg font-medium">{title}</h3>
          </div>
        )}
      </div>
    </Modal>
  );
};
