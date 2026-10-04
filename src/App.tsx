import { useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './app-context';
import { setSetting } from './db/db';
import { useAllData, useSettings, useStatus, useToday } from './hooks';
import { isStandalone, platform, requestPersist } from './lib/install';
import { Link, navigate, useRoute } from './router';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { TrainMenu } from './pages/TrainMenu';
import { ProlongedTrainer } from './pages/ProlongedTrainer';
import { MetronomePage } from './pages/MetronomePage';
import { RecordPage } from './pages/RecordPage';
import { DailyLogPage } from './pages/DailyLogPage';
import { MindMenu } from './pages/MindMenu';
import { LadderPage } from './pages/LadderPage';
import { ThoughtPage } from './pages/ThoughtPage';
import { SurveyPage } from './pages/SurveyPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportPage } from './pages/ReportPage';
import { SettingsPage } from './pages/SettingsPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { ClinicPage } from './pages/ClinicPage';
import { DafTestPage } from './pages/DafTestPage';
import { DafToolPage } from './pages/DafToolPage';
import { ModificationPage } from './pages/ModificationPage';

const NAV = [
  { to: '/', label: '오늘', ico: '◎' },
  { to: '/train', label: '훈련', ico: '♪' },
  { to: '/record', label: '녹음', ico: '●' },
  { to: '/mind', label: '마음', ico: '♡' },
  { to: '/history', label: '기록', ico: '▤' },
];

export function App() {
  const data = useAllData();
  const settings = useSettings();
  const today = useToday();
  const status = useStatus(data, today);

  // 글자 크기·테마
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.font = String(settings.fontScale);
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    if (settings && data?.profile && !settings.persistGranted) {
      void requestPersist().then((ok) => {
        if (ok) void setSetting('persistGranted', true);
      });
    }
  }, [settings, data?.profile]);

  if (!data || !settings) return null;
  if (!data.profile || !settings.onboardingDone || !status) return <Onboarding />;

  return (
    <AppProvider value={{ data: { ...data, profile: data.profile }, status, settings, today }}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { path } = useRoute();
  const { settings } = useApp();
  const page = routePage(path);
  const hideNav = /^\/(report|clinic|calibration|daf-test)/.test(path);
  return (
    <div className={`app ${hideNav ? 'no-nav' : ''}`}>
      <InstallBanner dismissed={settings.installDismissed} />
      {page}
      {!hideNav && (
        <nav className="nav" aria-label="주 메뉴">
          <div className="nav-inner">
            {NAV.map((n) => {
              const active = n.to === '/' ? path === '/' : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <span className="ico" aria-hidden>
                    {n.ico}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function routePage(path: string): ReactNode {
  switch (path) {
    case '/':
      return <Home />;
    case '/train':
      return <TrainMenu />;
    case '/train/prolonged':
      return <ProlongedTrainer />;
    case '/train/metronome':
      return <MetronomePage />;
    case '/train/daf':
      return <DafToolPage />;
    case '/train/modification':
      return <ModificationPage />;
    case '/record':
      return <RecordPage />;
    case '/log':
      return <DailyLogPage />;
    case '/mind':
      return <MindMenu />;
    case '/mind/ladder':
      return <LadderPage />;
    case '/mind/thought':
      return <ThoughtPage />;
    case '/survey':
      return <SurveyPage />;
    case '/history':
      return <HistoryPage />;
    case '/report':
      return <ReportPage />;
    case '/settings':
      return <SettingsPage />;
    case '/calibration':
      return <CalibrationPage />;
    case '/clinic':
      return <ClinicPage />;
    case '/daf-test':
      return <DafTestPage />;
    default:
      navigate('/', true);
      return null;
  }
}

/** 미설치 상태 상시 경고 (iOS 는 7일 미사용 시 저장소가 삭제될 수 있음) */
function InstallBanner({ dismissed }: { dismissed: boolean }) {
  const [standalone, setStandalone] = useState(isStandalone);
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const on = () => setStandalone(isStandalone());
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);
  if (standalone) return null;
  const ios = platform() === 'ios';
  if (!ios && dismissed) return null;
  return (
    <div className="banner no-print" role="alert">
      <span aria-hidden>⚠</span>
      <span className="grow">
        {ios
          ? '홈 화면에 설치하지 않으면 7일 미사용 시 기록이 삭제될 수 있어요.'
          : '홈 화면에 설치하면 오프라인에서도 안전하게 쓸 수 있어요.'}
      </span>
      <Link to="/settings?install=1" className="btn ghost" style={{ minHeight: 40, padding: '0 8px' }}>
        설치 방법
      </Link>
    </div>
  );
}
