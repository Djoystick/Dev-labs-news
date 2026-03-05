import { ChevronRight, X } from 'lucide-react';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { Button } from '@/components/ui/button';

const developerLink = 'https://t.me/Tvoy_Kosmonavt';

export function AboutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const appVersion = (import.meta.env as Record<string, string | undefined>).VITE_APP_VERSION?.trim() || '—';

  const onClose = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate('/profile', { replace: true });
  }, [location.key, navigate]);

  return (
    <FlatPage className="py-6 sm:py-8">
      <div className="space-y-2">
        <FlatSection className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold">О приложении</h1>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/0 to-white/0 px-4 py-4">
            <h2 className="text-xl font-semibold text-white">Dev-labs News</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/70">Новости и публикации в формате Telegram Mini App: быстрое чтение, подборки и персональные рекомендации.</p>
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-transparent">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-white/70">Версия</span>
              <span className="text-sm font-medium text-white">{appVersion}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-white/70">Платформа</span>
              <span className="text-sm font-medium text-white">Telegram Mini App</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-white/70">Разработчик</span>
              <span className="text-sm font-medium text-white">Твой Космонавт</span>
            </div>
          </div>
        </FlatSection>

        <FlatSection className="pt-2">
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full justify-between" onClick={() => navigate('/support')}>
              {'Поддержка'}
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button asChild type="button" variant="outline" className="w-full justify-between">
              <a href={developerLink} target="_blank" rel="noreferrer">
                {'Открыть Telegram разработчика'}
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </FlatSection>

        <FlatSection className="border-b-0 pt-2">
          <h3 className="text-sm font-semibold text-white/90">Что нового</h3>
          <p className="mt-1 text-sm text-white/65">Раздел обновлений появится в следующих релизах. Здесь будут краткие заметки о новых функциях и улучшениях.</p>
        </FlatSection>
      </div>
    </FlatPage>
  );
}
