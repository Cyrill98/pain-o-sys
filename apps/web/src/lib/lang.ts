import { useParams } from 'react-router';
import { DEFAULT_LANGUAGE, type Language } from '@app/shared';
import { isLanguage } from '@/i18n/detect';

/** Current language from the `:lng` route segment (validated by LangLayout). */
export function useLang(): Language {
  const { lng } = useParams();
  return isLanguage(lng) ? lng : DEFAULT_LANGUAGE;
}
