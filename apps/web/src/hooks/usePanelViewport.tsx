/**
 * usePanelViewport —— 面板级视口上下文（Compare 工作区专用）。
 *
 * 背景：Compare 工作区的每个面板可以「各自独立导航」（Synchronize All Charts
 * 关闭时），也可以共享同一个全局视口（开启时）。lane 组件（HiCMatrix /
 * TadBar / Pc1Lane / GeneLane / CTCFLoops …）与导航控件（RegionInput /
 * ZoomSlider / useDragPan / useD3Zoom）原来一律读全局 `useViewport` store。
 *
 * 本模块提供：
 *  - `PanelViewportProvider`：为子树挂一个独立 viewport store（挂载时继承
 *    全局当前区域，让「关同步」从共享区域起步）；
 *  - `usePanelViewport`：订阅当前面板的 viewport（无 Provider 时回退全局，
 *    保证普通页面 / 同步开时行为与原来完全一致）；
 *  - `usePanelViewportStore`：取当前面板 store 实例，用于事件处理器里的
 *    命令式 `getState()` / `setState()`（RegionInput 提交、拖拽平移等）。
 *
 * 用法：ComparePanel 在「同步关」时用 Provider 包住面板内容；「同步开」时
 * 不包 Provider，所有面板自然共享全局 store。
 */
import {
  createContext,
  useContext,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';

import {
  createViewportStore,
  useViewport,
  type ViewportStore,
  type ViewportStoreHook,
} from '../store/viewport';

/** 面板视口上下文；null = 未挂 Provider → 回退全局 store。 */
const PanelViewportContext = createContext<ViewportStoreHook | null>(null);

/**
 * 为子树提供独立 viewport store。
 *
 * 挂载时用全局当前区域初始化（而不是默认 chr1:1-2Mb），这样从同步切到
 * 独立时，面板仍停留在用户正在看的区域。
 */
export function PanelViewportProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [store] = useState<ViewportStoreHook>(() => {
    const next = createViewportStore();
    const global = useViewport.getState();
    next.setState({
      chr: global.chr,
      start: global.start,
      end: global.end,
      bin: global.bin,
    });
    return next;
  });
  return (
    <PanelViewportContext.Provider value={store}>
      {children}
    </PanelViewportContext.Provider>
  );
}

/** 取当前面板的 store 实例；未挂 Provider 时返回全局 store。 */
export function usePanelViewportStore(): ViewportStoreHook {
  const panelStore = useContext(PanelViewportContext);
  return panelStore ?? useViewport;
}

/**
 * 订阅当前面板 viewport。
 * 传 selector 取局部状态；不传返回整个 viewport 状态对象。
 */
export function usePanelViewport(): ViewportStore;
export function usePanelViewport<U>(selector: (state: ViewportStore) => U): U;
export function usePanelViewport<U>(
  selector?: (state: ViewportStore) => U,
): ViewportStore | U {
  const store = usePanelViewportStore();
  return selector ? useStore(store, selector) : useStore(store);
}
