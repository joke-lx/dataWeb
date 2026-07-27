import { useIntl } from 'react-intl';

export function useAppIntl() {
  const intl = useIntl();
  return {
    intl,
    t: (
      id: string,
      valuesOrMsg?: Record<string, string | number | boolean | Date | null | undefined> | string,
      defaultMsg?: string,
    ): string => {
      if (typeof valuesOrMsg === 'string') {
        return intl.formatMessage({ id, defaultMessage: valuesOrMsg });
      }
      if (defaultMsg) {
        return intl.formatMessage({ id, defaultMessage: defaultMsg }, valuesOrMsg);
      }
      return intl.formatMessage({ id }, valuesOrMsg);
    },
  };
}
