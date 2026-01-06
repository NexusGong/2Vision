/*
 * 诗词分析预览组件
 * 展示诗词分析结果，支持用户编辑分镜内容
 */

import React, { useState, useCallback } from "react";
import classNames from "classnames";
import {
  Button,
  Input,
  Collapse,
  Tag,
  Tooltip,
  Space,
} from "@arco-design/web-react";
import {
  IconEdit,
  IconCheck,
  IconClose,
  IconRefresh,
  IconArrowRight,
  IconUp,
  IconDown,
} from "@arco-design/web-react/icon";
import type {
  PoetryAnalysisData,
  PoetryInfo,
  LineAnalysis,
  Storyboard,
} from "../../apis";
import styles from "./index.module.less";

const { TextArea } = Input;
const CollapseItem = Collapse.Item;

export interface AnalysisPreviewProps {
  data: PoetryAnalysisData;
  mode: "storybook" | "comics";
  isLoading?: boolean;
  isConfirmed?: boolean; // 是否已确认（已确认时显示折叠的只读版本）
  onConfirm: (data: PoetryAnalysisData) => void;
  onReanalyze?: () => void;
  onCancel?: () => void;
}

// 诗词信息编辑组件
const PoetryInfoEditor: React.FC<{
  data: PoetryInfo;
  onChange: (data: PoetryInfo) => void;
}> = ({ data, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);

  const handleSave = () => {
    onChange(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={styles.poetryInfoEditor}>
        <div className={styles.editorHeader}>
          <span className={styles.editorTitle}>编辑诗词信息</span>
          <Space>
            <Button
              type="text"
              size="small"
              icon={<IconCheck />}
              onClick={handleSave}
            />
            <Button
              type="text"
              size="small"
              icon={<IconClose />}
              onClick={handleCancel}
            />
          </Space>
        </div>
        <div className={styles.editorForm}>
          <div className={styles.formRow}>
            <label>标题</label>
            <Input
              value={editData.title}
              onChange={(v) => setEditData({ ...editData, title: v })}
            />
          </div>
          <div className={styles.formRow}>
            <label>作者</label>
            <Input
              value={editData.author}
              onChange={(v) => setEditData({ ...editData, author: v })}
            />
          </div>
          <div className={styles.formRow}>
            <label>朝代</label>
            <Input
              value={editData.dynasty}
              onChange={(v) => setEditData({ ...editData, dynasty: v })}
            />
          </div>
          <div className={styles.formRow}>
            <label>完整诗词</label>
            <TextArea
              value={editData.full_text}
              onChange={(v) => setEditData({ ...editData, full_text: v })}
              autoSize={{ minRows: 3, maxRows: 8 }}
            />
          </div>
          <div className={styles.formRow}>
            <label>创作背景</label>
            <TextArea
              value={editData.creation_background}
              onChange={(v) =>
                setEditData({ ...editData, creation_background: v })
              }
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </div>
          <div className={styles.formRow}>
            <label>时代背景</label>
            <TextArea
              value={editData.era_background}
              onChange={(v) => setEditData({ ...editData, era_background: v })}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.poetryInfo}>
      <div className={styles.poetryHeader}>
        <h2 className={styles.poetryTitle}>{data.title}</h2>
        <span className={styles.poetryMeta}>
          {data.dynasty} · {data.author}
        </span>
        <Button
          type="text"
          size="small"
          icon={<IconEdit />}
          onClick={() => setIsEditing(true)}
          className={styles.editBtn}
        />
      </div>
      <div className={styles.poetryText}>
        {data.full_text.split("\n").map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
      {data.creation_background && (
        <div className={styles.background}>
          <h4>创作背景</h4>
          <p>{data.creation_background}</p>
        </div>
      )}
      {data.era_background && (
        <div className={styles.background}>
          <h4>时代背景</h4>
          <p>{data.era_background}</p>
        </div>
      )}
    </div>
  );
};

// 逐句分析组件
const LineAnalysisView: React.FC<{
  data: LineAnalysis[];
  onChange: (data: LineAnalysis[]) => void;
}> = ({ data, onChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<LineAnalysis | null>(null);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditData({ ...data[index] });
  };

  const handleSave = () => {
    if (editData && editingIndex !== null) {
      const newData = [...data];
      newData[editingIndex] = editData;
      onChange(newData);
    }
    setEditingIndex(null);
    setEditData(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData(null);
  };

  return (
    <Collapse bordered={false} className={styles.lineAnalysis}>
      {data.map((item, index) => (
        <CollapseItem
          key={index}
          name={String(index)}
          header={
            <div className={styles.lineHeader}>
              <span className={styles.lineNumber}>第{item.line_number}句</span>
              <span className={styles.lineText}>{item.line}</span>
            </div>
          }
          extra={
            editingIndex !== index && (
              <Button
                type="text"
                size="mini"
                icon={<IconEdit />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(index);
                }}
              />
            )
          }
        >
          {editingIndex === index && editData ? (
            <div className={styles.lineEditor}>
              <div className={styles.formRow}>
                <label>原句</label>
                <Input
                  value={editData.line}
                  onChange={(v) => setEditData({ ...editData, line: v })}
                />
              </div>
              <div className={styles.formRow}>
                <label>字词解释</label>
                <TextArea
                  value={editData.word_explanation}
                  onChange={(v) =>
                    setEditData({ ...editData, word_explanation: v })
                  }
                  autoSize={{ minRows: 2 }}
                />
              </div>
              <div className={styles.formRow}>
                <label>句意解读</label>
                <TextArea
                  value={editData.interpretation}
                  onChange={(v) =>
                    setEditData({ ...editData, interpretation: v })
                  }
                  autoSize={{ minRows: 2 }}
                />
              </div>
              <div className={styles.formRow}>
                <label>意象</label>
                <Input
                  value={editData.imagery.join(", ")}
                  onChange={(v) =>
                    setEditData({
                      ...editData,
                      imagery: v.split(",").map((s) => s.trim()),
                    })
                  }
                  placeholder="用逗号分隔多个意象"
                />
              </div>
              <div className={styles.formRow}>
                <label>情感</label>
                <Input
                  value={editData.emotion}
                  onChange={(v) => setEditData({ ...editData, emotion: v })}
                />
              </div>
              <div className={styles.formRow}>
                <label>修辞手法</label>
                <Input
                  value={editData.rhetoric}
                  onChange={(v) => setEditData({ ...editData, rhetoric: v })}
                />
              </div>
              <Space className={styles.editorActions}>
                <Button type="primary" size="small" onClick={handleSave}>
                  保存
                </Button>
                <Button size="small" onClick={handleCancel}>
                  取消
                </Button>
              </Space>
            </div>
          ) : (
            <div className={styles.lineContent}>
              <div className={styles.lineItem}>
                <span className={styles.label}>字词解释：</span>
                <span>{item.word_explanation}</span>
              </div>
              <div className={styles.lineItem}>
                <span className={styles.label}>句意解读：</span>
                <span>{item.interpretation}</span>
              </div>
              <div className={styles.lineItem}>
                <span className={styles.label}>意象：</span>
                <Space>
                  {item.imagery.map((img, i) => (
                    <Tag key={i} color="arcoblue" size="small">
                      {img}
                    </Tag>
                  ))}
                </Space>
              </div>
              <div className={styles.lineItem}>
                <span className={styles.label}>情感：</span>
                <Tag color="purple" size="small">
                  {item.emotion}
                </Tag>
              </div>
              {item.rhetoric && (
                <div className={styles.lineItem}>
                  <span className={styles.label}>修辞手法：</span>
                  <span>{item.rhetoric}</span>
                </div>
              )}
            </div>
          )}
        </CollapseItem>
      ))}
    </Collapse>
  );
};

// 分镜编辑器组件
const StoryboardEditor: React.FC<{
  data: Storyboard[];
  mode: "storybook" | "comics";
  onChange: (data: Storyboard[]) => void;
}> = ({ data, mode, onChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<Storyboard | null>(null);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditData({ ...data[index] });
  };

  const handleSave = () => {
    if (editData && editingIndex !== null) {
      const newData = [...data];
      newData[editingIndex] = editData;
      onChange(newData);
    }
    setEditingIndex(null);
    setEditData(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= data.length) return;

    const newData = [...data];
    const temp = newData[index];
    newData[index] = newData[newIndex];
    newData[newIndex] = temp;

    // 重新编号
    newData.forEach((item, i) => {
      item.index = i + 1;
    });

    onChange(newData);
  };

  return (
    <div className={styles.storyboardEditor}>
      <div className={styles.storyboardHeader}>
        <h3>分镜列表</h3>
        <Tag color={mode === "storybook" ? "blue" : "orange"}>
          {mode === "storybook" ? "故事书模式" : "连环画模式"}
        </Tag>
      </div>
      <div className={styles.storyboardList}>
        {data.map((item, index) => (
          <div
            key={index}
            className={classNames(styles.storyboardItem, {
              [styles.coverItem]: item.type === "cover",
              [styles.editing]: editingIndex === index,
            })}
          >
            <div className={styles.storyboardItemHeader}>
              <div className={styles.storyboardIndex}>
                <span className={styles.indexNumber}>{item.index}</span>
                <Tag size="small" color={item.type === "cover" ? "red" : "gray"}>
                  {item.type === "cover" ? "封面" : "内容"}
                </Tag>
              </div>
              <div className={styles.storyboardActions}>
                {index > 0 && (
                  <Tooltip content="上移">
                    <Button
                      type="text"
                      size="mini"
                      icon={<IconUp />}
                      onClick={() => handleMove(index, "up")}
                    />
                  </Tooltip>
                )}
                {index < data.length - 1 && (
                  <Tooltip content="下移">
                    <Button
                      type="text"
                      size="mini"
                      icon={<IconDown />}
                      onClick={() => handleMove(index, "down")}
                    />
                  </Tooltip>
                )}
                <Tooltip content="编辑">
                  <Button
                    type="text"
                    size="mini"
                    icon={<IconEdit />}
                    onClick={() => handleEdit(index)}
                  />
                </Tooltip>
              </div>
            </div>

            {editingIndex === index && editData ? (
              <div className={styles.storyboardForm}>
                <div className={styles.formRow}>
                  <label>标题</label>
                  <Input
                    value={editData.title}
                    onChange={(v) => setEditData({ ...editData, title: v })}
                  />
                </div>
                {editData.type === "cover" && (
                  <div className={styles.formRow}>
                    <label>副标题</label>
                    <Input
                      value={editData.subtitle || ""}
                      onChange={(v) =>
                        setEditData({ ...editData, subtitle: v })
                      }
                    />
                  </div>
                )}
                <div className={styles.formRow}>
                  <label>诗句/文本</label>
                  <TextArea
                    value={editData.text}
                    onChange={(v) => setEditData({ ...editData, text: v })}
                    autoSize={{ minRows: 2 }}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>场景描述</label>
                  <TextArea
                    value={editData.scene_description}
                    onChange={(v) =>
                      setEditData({ ...editData, scene_description: v })
                    }
                    autoSize={{ minRows: 2 }}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>图像生成提示词</label>
                  <TextArea
                    value={editData.image_prompt}
                    onChange={(v) =>
                      setEditData({ ...editData, image_prompt: v })
                    }
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="详细描述画面内容、构图、色调、风格等"
                  />
                </div>
                <div className={styles.formRow}>
                  <label>风格提示</label>
                  <Input
                    value={editData.style_hints}
                    onChange={(v) =>
                      setEditData({ ...editData, style_hints: v })
                    }
                    placeholder="如：中国古典绘画风格、水墨渲染"
                  />
                </div>
                <Space className={styles.editorActions}>
                  <Button type="primary" size="small" onClick={handleSave}>
                    保存
                  </Button>
                  <Button size="small" onClick={handleCancel}>
                    取消
                  </Button>
                </Space>
              </div>
            ) : (
              <div className={styles.storyboardContent}>
                <div className={styles.storyboardTitle}>{item.title}</div>
                {item.subtitle && (
                  <div className={styles.storyboardSubtitle}>
                    {item.subtitle}
                  </div>
                )}
                <div className={styles.storyboardText}>{item.text}</div>
                <div className={styles.storyboardPrompt}>
                  <span className={styles.promptLabel}>图像提示词：</span>
                  <span className={styles.promptText}>
                    {item.image_prompt.slice(0, 100)}
                    {item.image_prompt.length > 100 && "..."}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// 主组件
// 确保数据完整性的辅助函数
const ensureValidData = (data: PoetryAnalysisData | undefined | null): PoetryAnalysisData => {
  const defaultData: PoetryAnalysisData = {
    poetry_info: {
      title: "未知诗词",
      author: "未知",
      dynasty: "未知",
      full_text: "",
      creation_background: "",
      era_background: "",
    },
    line_analysis: [],
    storyboards: [],
  };

  if (!data) return defaultData;

  return {
    poetry_info: {
      ...defaultData.poetry_info,
      ...data.poetry_info,
    },
    line_analysis: data.line_analysis || [],
    storyboards: data.storyboards || [],
  };
};

const AnalysisPreview: React.FC<AnalysisPreviewProps> = ({
  data,
  mode,
  isLoading,
  isConfirmed = false,
  onConfirm,
  onReanalyze,
  onCancel,
}) => {
  // 确保初始数据完整性
  const [analysisData, setAnalysisData] = useState<PoetryAnalysisData>(() => ensureValidData(data));

  const handlePoetryInfoChange = useCallback((newInfo: PoetryInfo) => {
    setAnalysisData((prev) => ({
      ...prev,
      poetry_info: newInfo,
    }));
  }, []);

  const handleLineAnalysisChange = useCallback((newLines: LineAnalysis[]) => {
    setAnalysisData((prev) => ({
      ...prev,
      line_analysis: newLines,
    }));
  }, []);

  const handleStoryboardChange = useCallback((newStoryboards: Storyboard[]) => {
    setAnalysisData((prev) => ({
      ...prev,
      storyboards: newStoryboards,
    }));
  }, []);

  const handleConfirm = () => {
    onConfirm(analysisData);
  };

  // 已确认状态：显示完整的只读内容（不折叠）
  if (isConfirmed) {
    return (
      <div className={styles.confirmedPreview}>
        <div className={styles.confirmedHeader}>
          <div className={styles.confirmedInfo}>
            <Tag color="green" size="small">分析完成</Tag>
            <span className={styles.confirmedTitle}>
              {analysisData.poetry_info?.title}
            </span>
            <span className={styles.confirmedMeta}>
              {analysisData.poetry_info?.dynasty} · {analysisData.poetry_info?.author}
            </span>
            <span className={styles.confirmedCount}>
              共 {analysisData.storyboards?.length || 0} 个分镜
            </span>
          </div>
        </div>
        
        <div className={styles.confirmedContent}>
          {/* 诗词基本信息 */}
          <div className={styles.readonlySection}>
            <div className={styles.poetryText}>
              {analysisData.poetry_info?.full_text?.split("\n").map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
            {analysisData.poetry_info?.creation_background && (
              <div className={styles.background}>
                <h4>创作背景</h4>
                <p>{analysisData.poetry_info.creation_background}</p>
              </div>
            )}
            {analysisData.poetry_info?.era_background && (
              <div className={styles.background}>
                <h4>时代背景</h4>
                <p>{analysisData.poetry_info.era_background}</p>
              </div>
            )}
          </div>

          {/* 逐句分析完整内容 */}
          {analysisData.line_analysis && analysisData.line_analysis.length > 0 && (
            <div className={styles.readonlySection}>
              <h4>逐句分析</h4>
              <div className={styles.lineList}>
                {analysisData.line_analysis.map((item, idx) => (
                  <div key={idx} className={styles.lineItemFull}>
                    <div className={styles.lineHeader}>
                      <span className={styles.lineNumber}>第{item.line_number}句</span>
                      <span className={styles.lineText}>{item.line}</span>
                      <Tag size="small" color="purple">{item.emotion}</Tag>
                    </div>
                    <div className={styles.lineDetails}>
                      {item.word_explanation && (
                        <div className={styles.lineDetail}>
                          <span className={styles.detailLabel}>字词：</span>
                          <span>{item.word_explanation}</span>
                        </div>
                      )}
                      {item.interpretation && (
                        <div className={styles.lineDetail}>
                          <span className={styles.detailLabel}>句意：</span>
                          <span>{item.interpretation}</span>
                        </div>
                      )}
                      {item.imagery && item.imagery.length > 0 && (
                        <div className={styles.lineDetail}>
                          <span className={styles.detailLabel}>意象：</span>
                          <Space size={4}>
                            {item.imagery.map((img, i) => (
                              <Tag key={i} size="small" color="blue">{img}</Tag>
                            ))}
                          </Space>
                        </div>
                      )}
                      {item.rhetoric && (
                        <div className={styles.lineDetail}>
                          <span className={styles.detailLabel}>修辞：</span>
                          <span>{item.rhetoric}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 分镜完整内容 */}
          <div className={styles.readonlySection}>
            <h4>分镜列表</h4>
            <div className={styles.storyboardSummary}>
              {analysisData.storyboards?.map((sb, idx) => (
                <div key={idx} className={styles.storyboardItemFull}>
                  <div className={styles.sbHeader}>
                    <span className={styles.sbIndex}>{sb.index}</span>
                    <Tag size="small" color={sb.type === "cover" ? "red" : "gray"}>
                      {sb.type === "cover" ? "封面" : "内容"}
                    </Tag>
                    <span className={styles.sbTitle}>{sb.title}</span>
                  </div>
                  <div className={styles.sbContent}>
                    <div className={styles.sbText}>{sb.text}</div>
                    {sb.scene_description && (
                      <div className={styles.sbScene}>
                        <span className={styles.sceneLabel}>场景：</span>
                        {sb.scene_description}
                      </div>
                    )}
                    {sb.image_prompt && (
                      <div className={styles.sbPrompt}>
                        <span className={styles.promptLabel}>提示词：</span>
                        {sb.image_prompt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 未确认状态：显示完整的可编辑预览
  return (
    <div className={styles.analysisPreview}>
      <div className={styles.header}>
        <h3 className={styles.title}>诗词分析结果</h3>
        <span className={styles.subtitle}>
          请检查以下分析内容，可以进行编辑后再生成图像
        </span>
      </div>

      <div className={styles.content}>
        {/* 诗词基本信息 */}
        <section className={styles.section}>
          <PoetryInfoEditor
            data={analysisData.poetry_info}
            onChange={handlePoetryInfoChange}
          />
        </section>

        {/* 逐句分析 */}
        {analysisData.line_analysis && analysisData.line_analysis.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>逐句分析</h3>
            <LineAnalysisView
              data={analysisData.line_analysis}
              onChange={handleLineAnalysisChange}
            />
          </section>
        )}

        {/* 分镜编辑器 */}
        <section className={styles.section}>
          <StoryboardEditor
            data={analysisData.storyboards}
            mode={mode}
            onChange={handleStoryboardChange}
          />
        </section>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        {onReanalyze && (
          <Button
            type="secondary"
            icon={<IconRefresh />}
            onClick={onReanalyze}
            disabled={isLoading}
          >
            重新分析
          </Button>
        )}
        {onCancel && (
          <Button onClick={onCancel} disabled={isLoading}>
            取消
          </Button>
        )}
        <Button
          type="primary"
          icon={<IconArrowRight />}
          onClick={handleConfirm}
          loading={isLoading}
        >
          确认生成图像
        </Button>
      </div>
    </div>
  );
};

export default AnalysisPreview;

