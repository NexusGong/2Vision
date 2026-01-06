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

import React, { useEffect } from "react";
import classNames from "classnames";
import {
  Form,
  Upload,
  Input,
  Button,
  Select,
  Popover,
} from "@arco-design/web-react";
import { fileToBase64 } from "./utils";
import {
  SupportImageFileTypes,
  Resolution,
  Ratio,
  GenImageResolutionRatio2WHMap,
} from "./const";
import ImageConfigGroup from "./ImageConfigGroup";
import styles from "./index.module.less";
import { RatioThumb } from "./ImageConfigGroup/RatioThumb";

export interface PromptData {
  images?: string[];
  text?: string;
  mode?: "storybook" | "comics";
  ratio?: string;
  resolution?: string;
  size?: string;
}

export interface PromptProps {
  data?: PromptData;
  onSubmit?: (value: PromptData) => void;
}

const modes = [
  {
    key: "storybook",
    label: "故事书",
    description: "生成古诗词/古文故事书，适合课堂讲解",
  },
  {
    key: "comics",
    label: "连环画",
    description: "生成古诗词/古文连环画，适合课前预习",
  },
] as const;

const Prompt: React.FC<PromptProps> = ({ data, onSubmit }) => {
  const [form] = Form.useForm<PromptData>();
  const ratioValue = Form.useWatch("ratio", form as any) as Ratio;
  const resolutionValue = Form.useWatch(
    "resolution",
    form as any
  ) as Resolution;
  const modeValue = Form.useWatch("mode", form as any) as
    | "storybook"
    | "comics";
  const textValue = Form.useWatch("text", form as any) as string;
  const imagesValue = Form.useWatch("images", form as any);

  const handleSubmit = () => {
    const result = form.getFieldsValue();
    form.setFieldValue("text", "");
    form.setFieldValue("images", []);
    onSubmit?.(result);
  };

  useEffect(() => {
    const sizeArray =
      GenImageResolutionRatio2WHMap[resolutionValue]?.[ratioValue];
    // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"，如 "1440x2560"
    form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
  }, [ratioValue, resolutionValue]);

  useEffect(() => {
    if (modeValue === "storybook") {
      form.setFieldValue("ratio", Ratio.Ratio_9_16);
      const sizeArray =
        GenImageResolutionRatio2WHMap[resolutionValue]?.[Ratio.Ratio_9_16];
      // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"
      form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
    }
  }, [modeValue]);

  useEffect(() => {
    data && form.setFieldsValue(data || {});
  }, [data]);

  return (
    <Form
      form={form}
      className={classNames(
        "m-auto pt-3 sm:pt-4 px-3 sm:px-4 pb-2 max-w-[800px] w-full",
        styles.sender
      )}
      onSubmit={handleSubmit}
    >
      <div
        className={classNames(
          "flex flex-col flex-1 min-h-[50px] relative px-4 pt-3 pb-1"
        )}
      >
        <Form.Item className="w-full !mb-0" field="text">
          <Input.TextArea
            className="text-base !border-[0px] focus:shadow-none text-[black] resize-none !bg-transparent !p-0 leading-relaxed"
            autoSize={{ minRows: 1, maxRows: 8 }}
            placeholder="输入您的内容..."
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </Form.Item>
        
        {imagesValue?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Form.Item
              className="!mb-0"
              field="images"
              triggerPropName="fileList"
            >
              <Upload
                listType="picture-card"
                imagePreview
                multiple
                limit={10}
                accept={{
                  type: SupportImageFileTypes.map((t) => `.${t}`).join(","),
                  strict: false,
                }}
                onChange={() => {}}
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    onSuccess({
                      url: URL.createObjectURL(file),
                      base64: await fileToBase64(file),
                      name: file.name,
                    });
                  } catch (e: any) {
                    onError(e);
                  }
                }}
              />
            </Form.Item>
          </div>
        )}
      </div>

      <div className="flex justify-between items-end px-3 pb-2 pt-1 border-t border-gray-100/50">
        <div className="flex items-center gap-2">
          {/* 上传按钮 */}
          <div className="relative">
             {/* 隐藏实际的 Upload 组件，只保留逻辑，或者将 Upload 按钮移到这里 */}
            <div className="p-2 rounded-full bg-black/5 hover:bg-black/10 cursor-pointer text-gray-700 transition-colors" onClick={() => {
                // 触发上传逻辑，这里简化处理，实际需要与 Form.Item 联动或使用 ref
                const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                uploadInput?.click();
            }}>
                <div className="w-5 h-5 flex items-center justify-center border-2 border-current rounded-full text-xs font-bold relative top-[1px]">
                   <span className="relative -top-[1px]">+</span>
                </div>
            </div>
            {/* 隐藏的 Upload 组件用于承载文件选择 */}
            <div className="hidden">
                 <Form.Item
                  field="images"
                  triggerPropName="fileList"
                 >
                   <Upload
                     multiple
                     accept={{
                       type: SupportImageFileTypes.map((t) => `.${t}`).join(","),
                       strict: false,
                     }}
                     customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          onSuccess({
                            url: URL.createObjectURL(file),
                            base64: await fileToBase64(file),
                            name: file.name,
                          });
                        } catch (e: any) {
                          onError(e);
                        }
                      }}
                   />
                 </Form.Item>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-gray-300 mx-1"></div>

          <div className="flex items-center gap-1">
              <Form.Item
                field="mode"
                initialValue={"storybook"}
                className="!mb-0"
              >
                <Select
                  placeholder="模式"
                  allowClear={false}
                  bordered={false}
                  triggerProps={{
                    autoAlignPopupWidth: false,
                    position: "bl",
                    className: "min-w-[120px]"
                  }}
                  className="!bg-black/5 !border-none !px-2 hover:bg-black/10 rounded-lg h-8 text-gray-800 text-sm font-medium transition-colors min-w-[120px]"
                  renderFormat={(_, value) => {
                    const option = modes.find((o) => o.key === value);
                    return (
                        <span className="flex items-center gap-1 font-medium whitespace-nowrap">
                            <span className={classNames("w-2 h-2 rounded-full flex-shrink-0", value === 'storybook' ? 'bg-indigo-400' : 'bg-orange-400')}></span>
                            {option?.label}
                        </span>
                    );
                  }}
                >
                  {modes.map((option) => (
                    <Select.Option value={option.key} key={option.key}>
                      <div>
                        <div className="text-[14px] font-medium">{option.label}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Popover
                trigger="click"
                className="min-w-[410px]"
                content={
                  <ImageConfigGroup
                    value={{
                      resolution: resolutionValue,
                      ratio:
                        modeValue === "storybook" ? Ratio.Ratio_9_16 : ratioValue,
                    }}
                    lockRatio={
                      modeValue === "storybook" ? Ratio.Ratio_9_16 : undefined
                    }
                    onChange={(val) => {
                      form.setFieldValue("resolution", val.resolution);
                      form.setFieldValue("ratio", val.ratio);
                      const sizeArray =
                        GenImageResolutionRatio2WHMap[val.resolution]?.[
                          val.ratio
                        ];
                      // 火山方舟 API 要求 size 格式为 "WIDTHxHEIGHT"
                      form.setFieldValue("size", sizeArray ? sizeArray.join("x") : "");
                    }}
                  />
                }
              >
                <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-black/5 hover:bg-black/10 cursor-pointer text-gray-800 text-sm transition-colors font-medium">
                  <div className="font-medium text-xs border border-gray-400 rounded px-1">{resolutionValue || "2K"}</div>
                  <div className="flex items-center gap-1">
                     <span className="w-4 h-4 flex items-center justify-center">
                        <RatioThumb
                          ratio={
                            modeValue === "storybook"
                              ? Ratio.Ratio_9_16
                              : (ratioValue as Ratio) || Ratio.Ratio_1_1
                          }
                        />
                     </span>
                    <span className="text-xs">
                      {modeValue === "storybook"
                        ? Ratio.Ratio_9_16
                        : ratioValue || Ratio.Ratio_1_1}
                    </span>
                  </div>
                </div>
              </Popover>
          </div>
          
           {/* 隐藏字段 */}
          <Form.Item field="ratio" initialValue={Ratio.Ratio_1_1} noStyle>
            <div></div>
          </Form.Item>
          <Form.Item
            field="resolution"
            initialValue={Resolution.Resolution_2K}
            noStyle
          >
            <div></div>
          </Form.Item>
          <Form.Item field="size" noStyle>
            <div></div>
          </Form.Item>
        </div>

        <div>
          <Form.Item className="!mb-0">
            <Button
              type="primary"
              className={classNames(
                  "rounded-full w-9 h-9 !p-0 flex items-center justify-center transition-all duration-300",
                  textValue ? "bg-black text-white hover:bg-gray-800" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
              htmlType="submit"
              disabled={!textValue}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </Form.Item>
        </div>
      </div>
    </Form>
  );
};

export default Prompt;
