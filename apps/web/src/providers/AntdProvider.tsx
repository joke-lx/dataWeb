/**
 * AntdProvider — 把 antd 的 ConfigProvider 接入应用 i18n 与 design token。
 *
 * 职责：让 antd 组件（Table / Drawer / Tabs / Button ...）的主题色、圆角、
 * 字号、内置文案（分页/空态/弹出层）跟随应用的蓝灰 theme 与当前语言。
 *
 * 为什么单独一个 provider 组件而不是在 main.tsx 内联：
 *   - antd 的 theme token 必须是**字面量**（CSS-in-JS 无法读 CSS 变量），
 *     集中在一个命名组件里，便于保持与 tokens.css 的同步（见下方注释）；
 *   - 它要订阅 i18n locale 才能切换 antd 内置文案，所以放在 I18nApp 内层。
 *
 * 为什么不 import 'antd/dist/reset.css'：antd v5 是 CSS-in-JS，组件样式
 * 按需注入，与项目自己的 reset.css / tokens.css 无冲突，无需全局样式。
 */
import type { JSX, ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';

import { useAppSelector } from '../i18n';

/** 与 `styles/tokens.css` 保持一致的字面量镜像（antd token 不能引用 CSS 变量）。 */
const ANTD_THEME = {
  token: {
    colorPrimary: '#4d6e8c',
    colorInfo: '#4d6e8c',
    colorLink: '#4d6e8c',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
  },
  components: {
    // 让 antd 的表格/标签页贴近项目的克制风格。
    Table: { headerBg: '#f3f5f7' },
    Tabs: { itemSelectedColor: '#4d6e8c', inkBarColor: '#4d6e8c' },
  },
};

/**
 * 根据应用 locale 返回 antd 内置文案包（分页条、日期、空态等）。
 */
function antdLocale(appLocale: string): typeof enUS {
  return appLocale === 'zh-CN' ? zhCN : enUS;
}

/**
 * 包裹 antd 的 ConfigProvider。
 *
 * @param props - `children` 为整棵 React 树。
 * @returns 带 antd 主题与 locale 的 provider 树。
 */
export function AntdProvider({ children }: { children: ReactNode }): JSX.Element {
  const locale = useAppSelector((state) => state.i18n.locale);
  return (
    <ConfigProvider theme={ANTD_THEME} locale={antdLocale(locale)}>
      {children}
    </ConfigProvider>
  );
}