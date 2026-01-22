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

import {
  IDataCoverItem,
  IDataItem,
  IDataPageImageItem,
  IDataPageTextItem,
  IVsStorybookPage,
} from "../types";

export const dataAdaptor = (list: IDataItem[]) => {
  const len = list.length;
  // 计算内容页数量（排除封面）
  const contentPageCount = list.filter(item => !item.isCover).length;
  
  return list.reduce<IVsStorybookPage[]>((acc, item, index) => {
    // 封面
    if (item.isCover) {
      acc.push({
        key: item.id,
        showTitle: false, // 封面不需要显示额外文本，图片本身已包含
        ...item,
      } satisfies IDataCoverItem);
    } else {
      // 左侧图片页
      acc.push({
        id: item.id,
        key: `${item.id}-img`,
        url: item.url,
        originalUrl: (item as any).originalUrl, // 传递原始URL用于回退
      } satisfies IDataPageImageItem);
      // 右侧正文
      const textContent = item.text || "";
      // 调试：检查文本内容
      if (process.env.NODE_ENV === 'development') {
        if (!textContent) {
          console.warn(`dataAdaptor: 内容页 ${index} 文本为空`, { item, textContent });
        } else {
          console.log(`dataAdaptor: 内容页 ${index} 文本内容`, { 
            index, 
            text: textContent, 
            textLength: textContent.length,
            isLastPage: index === len - 1
          });
        }
      }
      
      // 计算内容页编号（从1开始，排除封面）
      const contentPageNumber = list.slice(0, index).filter(i => !i.isCover).length + 1;
      
      acc.push({
        id: item.id,
        key: `${item.id}-text`,
        text: textContent, // 确保文本不为undefined
        isLastPage: index === len - 1,
        pageNumber: contentPageNumber, // 使用内容页编号而不是原始索引
        pageTotal: contentPageCount,
      } satisfies IDataPageTextItem);
    }
    return acc;
  }, []);
};

/**
 * 组件内部通过number来表示页面， 对外组件使用索引展示
 * */
export const currentPageToPageNumberAdaptor = (num: number) => {
  // 封面图
  if (num === 1) {
    return 0;
  }
  return Math.ceil((num - 1) / 2);
};

/**
 * 总数适配器
 * */
export const totalPageAdaptor = (total: number) => {
  return Math.floor(total / 2);
};

/**
 * 数据适配器
 * */
export const stateAdaptor = {
  list: dataAdaptor,
  currentPage: currentPageToPageNumberAdaptor,
  totalPage: totalPageAdaptor,
};

/**
 * 方法适配器
 * @param pageNum 页码 -1为封面， 其他定义为索引
 * */
export const indexToPageAdaptor = (index: number) => {
  if (index === 0) {
    return 1;
  }
  return index * 2 + 1;
};
