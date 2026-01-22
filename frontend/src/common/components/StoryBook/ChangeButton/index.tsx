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

import { CSSProperties, FC, useState } from "react";
import { ReactComponent as IconArrowLeft } from "./assets/left-arrow.svg";
import { ReactComponent as IconArrowRight } from "./assets/right-arrow.svg";
import { ReactComponent as IconToLeft } from "./assets/to-left.svg";
import { ReactComponent as IconToRight } from "./assets/to-right.svg";
import cls from "classnames";
import { useMemoizedFn } from "ahooks";
import { Trigger } from "@arco-design/web-react";
import { useStoryBookAPI, useStoryBooksState } from "../";
import { useKeyboardNavigation } from "../hooks/useKeyBoardNavigation";
export interface StorybookChangeButtonProps {
  className?: string;
  style?: CSSProperties;
  btnText?: {
    prev?: string;
    next?: string;
    page?: string;
  };
}

const StorybookChangeButton: FC<StorybookChangeButtonProps> = (props) => {
  const { className, style, btnText } = props;
  const api = useStoryBookAPI();
  const state = useStoryBooksState();
  const { isFirstPage, isLastPage, pageNum, totalPage } = state ?? {};
  const { goNextPage, goPrevPage, goFirstPage, goLastPage } = api ?? {};
  const [popupVisible, setPopupVisible] = useState(false);

  const prev = useMemoizedFn(() => {
    goPrevPage?.();
  });
  const next = useMemoizedFn(() => {
    goNextPage?.();
  });
  const goFirst = useMemoizedFn(() => {
    goFirstPage?.();
    setPopupVisible(false);
  });
  const goEnd = useMemoizedFn(() => {
    goLastPage?.();
    setPopupVisible(false);
  });

  useKeyboardNavigation({ onLeftArrow: prev, onRightArrow: next });

  return (
    <div
      className={`flex items-center space-x-3 flex-1 justify-center ${className}`}
      style={style}
    >
      <div
        onClick={prev}
        className={cls(
          "cursor-pointer w-6 h-6 text-white/70 hover:text-cyan-400 transition-colors",
          { "pointer-events-none": isFirstPage },
          `${isFirstPage ? "!text-white/30" : ""}`,
          `p-[2px] hover:bg-white/10 rounded-[4px]`
        )}
      >
        <IconArrowLeft />
      </div>
      <Trigger
        popupVisible={popupVisible}
        trigger="click"
        position="bl"
        onClickOutside={() => setPopupVisible(false)}
        popup={() => (
          <div
            className="flex flex-col rounded-lg py-[8px] px-[6px] w-[240px] space-y-[4px] cursor-pointer backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 20, 35, 0.95), rgba(30, 30, 50, 0.95))',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 212, 255, 0.1)',
            }}
          >
            <div
              className={cls(
                "py-[5px] px-[12px] flex items-center space-x-[6px] text-white/90 select-none",
                isFirstPage
                  ? "cursor-not-allowed !text-white/30"
                  : "hover:bg-cyan-500/20 rounded hover:text-cyan-400"
              )}
              onClick={goFirst}
            >
              <IconToLeft />
              <span>{btnText?.prev || "跳转到开头"}</span>
            </div>
            <div
              className={cls(
                "py-[5px] px-[12px] flex items-center space-x-[6px] text-white/90 select-none",
                isLastPage
                  ? "cursor-not-allowed !text-white/30"
                  : "hover:bg-cyan-500/20 rounded hover:text-cyan-400"
              )}
              onClick={goEnd}
            >
              <IconToRight />
              <span>{btnText?.next || "跳转到结尾"}</span>
            </div>
          </div>
        )}
      >
        <div
          className="select-none w-[54px] flex items-center justify-center hover:bg-white/10 rounded-[6px] transition-colors"
          onClick={() => setPopupVisible(true)}
        >
          {isFirstPage ? (
            <div className="text-white/90 text-[14px] leading-6">
              {btnText?.page || "封面"}
            </div>
          ) : (
            <div className="text-white/90 text-[14px] leading-6">
              <span>{pageNum!}</span>
              <span className="text-white/50"> / {totalPage!}</span>
            </div>
          )}
        </div>
      </Trigger>
      <div
        onClick={next}
        className={cls(
          "cursor-pointer w-6 h-6 text-white/70 hover:text-cyan-400 transition-colors",
          {
            "pointer-events-none": isLastPage,
          },
          `${isLastPage ? "!text-white/30" : ""}`,
          `p-[2px] hover:bg-white/10 rounded-[4px]`
        )}
      >
        <IconArrowRight />
      </div>
    </div>
  );
};
export { StorybookChangeButton };
