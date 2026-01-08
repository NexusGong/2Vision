/*
 * 我的作品页面视图
 * 与故事书卡片风格完全统一
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Message,
  Popconfirm,
  Input,
  Tooltip,
  Button,
} from "@arco-design/web-react";
import {
  IconDelete,
  IconEdit,
  IconBook,
  IconClose,
  IconCheck,
  IconArrowLeft,
} from "@arco-design/web-react/icon";
import {
  GenerationRecord,
  getGenerationRecords,
  deleteGenerationRecord,
  clearAllGenerationRecords,
  updateGenerationRecordTitle,
  migrateFromChatHistory,
} from "../../utils/generations";
import { formatDate } from "../../utils";
import { GenerateStoryBookResponse } from "../../apis";
import { VsStoryBookPureCoverPage } from "@/common/components/StoryBook";
import styles from "./index.module.less";

interface GenerationsViewProps {
  onBack: () => void;
  onViewStorybook: (data: GenerateStoryBookResponse) => void;
  onViewComics: (data: GenerateStoryBookResponse) => void;
}

// 箭头图标组件
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="9" fill="none" viewBox="0 0 13 9">
    <path fill="currentColor" fillRule="evenodd" d="M10.575 3.809 7.941 1.175a.667.667 0 0 1 .943-.943l3.535 3.536a1 1 0 0 1 0 1.414L8.885 8.717a.667.667 0 1 1-.943-.942l2.633-2.633H1.032a.667.667 0 0 1 0-1.333z" clipRule="evenodd"/>
  </svg>
);

const GenerationsView: React.FC<GenerationsViewProps> = ({
  onBack,
  onViewStorybook,
  onViewComics,
}) => {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const loadRecords = useCallback(() => {
    migrateFromChatHistory();
    const allRecords = getGenerationRecords();
    setRecords(allRecords);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const handleUpdate = () => loadRecords();
    window.addEventListener("generations-updated", handleUpdate);
    return () => window.removeEventListener("generations-updated", handleUpdate);
  }, [loadRecords]);

  const confirmDelete = useCallback((id: string) => {
    if (deleteGenerationRecord(id)) {
      Message.success("删除成功");
      loadRecords();
    } else {
      Message.error("删除失败");
    }
  }, [loadRecords]);

  const handleClearAll = useCallback(() => {
    if (clearAllGenerationRecords()) {
      Message.success("已清空所有记录");
      loadRecords();
    } else {
      Message.error("清空失败");
    }
  }, [loadRecords]);

  const handleView = useCallback((record: GenerationRecord) => {
    if (editingId) return;
    if (record.mode === "storybook") {
      onViewStorybook(record.data);
    } else {
      onViewComics(record.data);
    }
  }, [onViewStorybook, onViewComics, editingId]);

  const handleStartEdit = useCallback((e: React.MouseEvent, record: GenerationRecord) => {
    e.stopPropagation();
    setEditingId(record.id);
    setEditingTitle(record.title);
  }, []);

  const handleSaveTitle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editingTitle.trim()) {
      if (updateGenerationRecordTitle(editingId, editingTitle.trim())) {
        Message.success("修改成功");
        loadRecords();
      }
    }
    setEditingId(null);
    setEditingTitle("");
  }, [editingId, editingTitle, loadRecords]);

  const handleCancelEdit = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingTitle("");
  }, []);

  return (
    <div className={styles.container}>
      {/* 页面头部 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <IconArrowLeft />
          <span>返回对话</span>
        </button>
        
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>我的作品</h1>
          <span className={styles.recordCount}>{records.length}</span>
        </div>

        {records.length > 0 && (
          <Popconfirm
            title="确定要清空所有作品吗？"
            onOk={handleClearAll}
          >
            <button className={styles.clearButton}>
              <IconDelete />
              清空
            </button>
          </Popconfirm>
        )}
      </div>

      {/* 作品列表 */}
      <div className={styles.content}>
        {records.length === 0 ? (
          <div className={styles.emptyWrapper}>
            <div className={styles.emptyIcon}>
              <IconBook />
            </div>
            <p className={styles.emptyTitle}>暂无作品</p>
            <p className={styles.emptyDesc}>生成的故事书与连环画将保存在这里</p>
            <Button type="primary" onClick={onBack}>
              开始创作
            </Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {records.map((record) => (
              <div key={record.id} className={`${styles.cardItem} pl-[18px] pb-[13px] pt-[22px] relative`}>
                <div className="cursor-pointer group" onClick={() => handleView(record)}>
                  {/* 卡片主体 - 固定高度避免跳动 */}
                  <div className="flex flex-col justify-between gap-[15px] border border-white/60 bg-white/60 backdrop-blur-md shadow-sm w-full h-[144px] rounded-[20px] pt-[16px] pb-[19px] pr-[28px] pl-[143px] transition-[transform,box-shadow,background-color] duration-300 group-hover:shadow-lg group-hover:bg-white/80 group-hover:-translate-y-1">
                    {/* 内容区 */}
                    <div className="flex flex-col gap-y-[4px]">
                      {editingId === record.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            size="small"
                            value={editingTitle}
                            onChange={setEditingTitle}
                            onPressEnter={() => handleSaveTitle()}
                            autoFocus
                            style={{ flex: 1 }}
                          />
                          <button 
                            className={styles.editAction}
                            onClick={handleSaveTitle}
                          >
                            <IconCheck />
                          </button>
                          <button 
                            className={styles.editAction}
                            onClick={handleCancelEdit}
                          >
                            <IconClose />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="overflow-hidden whitespace-nowrap overflow-ellipsis text-[14px] leading-[22px] tracking-[0.04px] font-[500] text-[#000000] flex-1">
                              {record.title}
                            </div>
                            <Tooltip content="修改标题" mini>
                              <button
                                className={styles.editBtn}
                                onClick={(e) => handleStartEdit(e, record)}
                              >
                                <IconEdit fontSize={13} />
                              </button>
                            </Tooltip>
                          </div>
                          <div className="text-[12px] leading-[20px] tracking-[0.04px] text-[#6e718c] text-justify overflow-hidden line-clamp-2">
                            {record.summary}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 底部 */}
                    <div className="flex items-center justify-between w-full gap-x-[8px]">
                      <div className="text-[11px] leading-[18px] text-[#aeafc2] whitespace-nowrap">
                        {formatDate(record.timestamp, "YYYY-MM-DD HH:mm")}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Popconfirm
                            title="确定删除此作品？"
                            onOk={() => confirmDelete(record.id)}
                            position="top"
                          >
                            <button className={styles.deleteBtn}>
                              <IconDelete fontSize={14} />
                            </button>
                          </Popconfirm>
                        </div>
                        
                        <Button className="shrink-0 flex justify-center items-center gap-x-[2px] px-[12px] py-[2px] border border-white/50 bg-white/40 rounded-full overflow-hidden text-[#3f3f51] text-[13px] leading-[22px] tracking-[0.04px] hover:bg-white/80 transition-all duration-300 shadow-sm backdrop-blur-sm">
                          查看
                          <ArrowRightIcon />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 封面 - 使用原版组件 */}
                  <div className="absolute bottom-0 left-0 origin-top-left w-[126px] h-[174px] rotate-[-3.19deg] cursor-pointer">
                    <VsStoryBookPureCoverPage url={record.coverUrl} />
                    {/* 模式标签 */}
                    <div className={`${styles.modeTag} ${record.mode === "comics" ? styles.comicsTag : ""}`}>
                      {record.mode === "storybook" ? "故事书" : "连环画"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationsView;
