import { Navigate } from 'react-router';
import { preferredLanguage } from '@/i18n/detect';

/** "/" → "/en" or "/ms" (saved choice, then browser language, then English). */
export function RootRedirect() {
  return <Navigate to={`/${preferredLanguage()}`} replace />;
}
