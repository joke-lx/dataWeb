/**
 * 包装 react-intl 的 useIntl，提供更易用的 `t(id, ..., default?)`。
 *
 * 职责：解决 react-intl `formatMessage` 的几个使用痛点：
 * 1. 单参数 / 双参数 / 三参数重载的歧义；
 * 2. 常用"给个默认消息"场景必须写 `{ id, defaultMessage }` 对象。
 *
 * 为什么存在：让组件层不必每次构造临时对象，所有翻译都收敛到 `t('home.hero.title')` 一种形式。
 */

import { useIntl } from 'react-intl';

/**
 * 返回 `{ intl, t }`。
 * - `t(id, defaultMsg?)`：直接用英文作为默认消息占位。
 * - `t(id, values, defaultMsg?)`：带占位符的翻译。
 */
export function useAppIntl() {
  const intl = useIntl();
  return {
    intl,
    t: (
      // 兼容三种签名：(id, defaultMsg), (id, values), (id, values, defaultMsg)。
      id: string,
      valuesOrMsg?: Record<string, string | number | boolean | Date | null | undefined> | string,
      defaultMsg?: string,
    ): string => {
      if (typeof valuesOrMsg === 'string') {
        // 第二参数是字符串：把它当 defaultMessage，简化单语调用。
        return intl.formatMessage({ id, defaultMessage: valuesOrMsg });
      }
      if (defaultMsg) {
        // 标准形式：values + defaultMessage 都给。
        return intl.formatMessage({ id, defaultMessage: defaultMsg }, valuesOrMsg);
      }
      // 只有 values（可能为 undefined），让 react-intl 用翻译包里的 defaultMessage。
      return intl.formatMessage({ id }, valuesOrMsg);
    },
  };
}
