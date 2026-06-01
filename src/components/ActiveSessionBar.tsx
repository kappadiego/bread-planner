import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { ActiveSession, ActiveSessionDerivedState } from '../domain/session/activeSessionTypes';
import { getActiveSessionDerivedState, getSessionPauseMinutes } from '../domain/session/activeSessionUtils';
import type { BrowserNotificationPermission } from '../domain/session/sessionNotifications';

type ActiveSessionBarProps = {
  session: ActiveSession;
  isDrawerOpen: boolean;
  notificationPermission: BrowserNotificationPermission;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onPause: () => void;
  onResume: () => void;
  onCompleteStep: () => void;
  onSkipStep: () => void;
  onFinish: () => void;
  onClear: () => void;
  onSaveJournal: () => void;
  onOpenDiary: () => void;
  onRequestNotifications: () => void;
  onToggleSound: () => void;
};

const formatClock = (value: number) =>
  new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatTimer = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

const formatDurationMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  if (hours > 0 && restMinutes > 0) {
    return `${hours}h ${restMinutes} min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${restMinutes} min`;
};

const getSessionCopy = (session: ActiveSession) => {
  const derived = getActiveSessionDerivedState(session);
  if (session.status === 'paused') {
    return {
      label: 'Timer in pausa',
      detail: derived.currentStep?.label ?? 'Sessione sospesa',
      tone: 'border-wheat-400/65',
      accent: 'text-crust',
      fill: 'bg-wheat-400',
      track: 'bg-wheat-400/18',
      surface: 'bg-wheat-400/18',
    };
  }
  if (session.status === 'completed') {
    return {
      label: 'Sessione completata',
      detail: 'Pronta da salvare nel Diario',
      tone: 'border-sage/55',
      accent: 'text-sage',
      fill: 'bg-sage',
      track: 'bg-cream',
      surface: 'bg-sage/14',
    };
  }

  return {
    label: 'Impasto in corso',
    detail: derived.currentStep?.label ?? 'Timeline avviata',
      tone: 'border-crust/55',
    accent: 'text-crust',
    fill: 'bg-crust',
    track: 'bg-cream',
    surface: 'bg-crust/10',
  };
};

const getCurrentStepRemainingMs = (
  session: ActiveSession,
  derived: ActiveSessionDerivedState,
) => {
  if (!derived.currentStep) {
    return 0;
  }

  const currentIndex = session.stepSchedule.findIndex((step) => step.stepId === derived.currentStep?.stepId);
  const elapsedBeforeCurrentStep = session.stepSchedule
    .slice(0, Math.max(0, currentIndex))
    .reduce((total, step) => total + step.durationMinutes * 60 * 1000, 0);
  const elapsedInCurrentStep = Math.max(0, derived.elapsedMs - elapsedBeforeCurrentStep);
  return Math.max(0, derived.currentStep.durationMinutes * 60 * 1000 - elapsedInCurrentStep);
};

export function ActiveSessionBar({
  session,
  isDrawerOpen,
  notificationPermission,
  onOpenDrawer,
  onCloseDrawer,
  onPause,
  onResume,
  onCompleteStep,
  onSkipStep,
  onFinish,
  onClear,
  onSaveJournal,
  onOpenDiary,
  onRequestNotifications,
  onToggleSound,
}: ActiveSessionBarProps) {
  const derived = getActiveSessionDerivedState(session);
  const copy = getSessionCopy(session);
  const recipeName = session.recipeSnapshot.name || session.recipeSnapshot.customProfileName || 'Impasto';
  const isActionable = session.status !== 'completed';
  const currentStepRemainingMs = getCurrentStepRemainingMs(session, derived);
  const notificationLabel = notificationPermission === 'granted'
    ? 'Attive'
    : notificationPermission === 'denied'
      ? 'Bloccate'
      : notificationPermission === 'unsupported'
        ? 'Non supportate'
        : 'Spente';

  return (
    <>
      <section className="bg-flour">
        <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <button
            type="button"
            onClick={onOpenDrawer}
            className={`bp-focus flex w-full flex-col gap-4 rounded-[18px] border border-l-[6px] bg-white p-4 text-left shadow-air sm:flex-row sm:items-center sm:justify-between lg:p-5 ${copy.tone}`}
            aria-label="Apri dettagli sessione attiva"
          >
            <div className="min-w-0 lg:flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream/70 ${copy.accent} ring-1 ring-current/20`}>
                  {session.status === 'paused' ? <Pause size={18} /> : session.status === 'completed' ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${copy.accent}`}>{copy.label}</p>
                  <h2 className="text-xl font-semibold text-ink lg:text-2xl">{recipeName}</h2>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm leading-5">
                <span className="rounded-full bg-cream/60 px-3 py-1 font-semibold text-ink ring-1 ring-ink/10">
                  {session.status === 'completed' ? 'Timeline completata' : `Step: ${derived.currentStep?.label ?? copy.detail}`}
                </span>
                {session.status === 'running' && (
                  <span className={`rounded-full bg-cream/60 px-3 py-1 font-semibold ${copy.accent} ring-1 ring-current/15`}>
                    Prossimo step tra {formatTimer(currentStepRemainingMs)}
                  </span>
                )}
              </div>
            </div>
            <div className="grid shrink-0 gap-2 sm:min-w-[210px]">
              <div className="rounded-2xl bg-cream/55 px-4 py-3 ring-1 ring-ink/10">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">Manca in tutto</div>
                <div className={`mt-1 font-mono text-2xl font-semibold ${copy.accent}`}>{formatTimer(derived.remainingMs)}</div>
                <div className={`mt-3 h-2 overflow-hidden rounded-full ${copy.track}`}>
                  <div className={`h-full rounded-full ${copy.fill}`} style={{ width: `${derived.progressPercentage}%` }} />
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[60] bg-[#322e2b]/38 backdrop-blur-[2px]" role="presentation" onMouseDown={onCloseDrawer}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Sessione attiva"
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[24px] bg-white p-4 shadow-air sm:bottom-auto sm:left-1/2 sm:top-4 sm:w-[min(980px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[24px] sm:p-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${copy.accent}`}>{copy.label}</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{recipeName}</h2>
              </div>
              <button
                type="button"
                onClick={onCloseDrawer}
                className="bp-focus grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white text-ink/70 transition hover:border-crust/35 hover:bg-cream/55 hover:text-ink"
                aria-label="Chiudi sessione"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`mt-4 rounded-[18px] border border-ink/10 p-4 ${copy.surface}`}>
              <p className="text-sm font-semibold text-ink/70">Step corrente</p>
              <p className="mt-1 text-[24px] font-semibold leading-7 text-ink">
                {session.status === 'completed' ? 'Timeline completata' : derived.currentStep?.label ?? 'Pronta per partire'}
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <SessionMetric label="Al prossimo step" value={formatTimer(currentStepRemainingMs)} />
                <SessionMetric label="Manca in tutto" value={formatTimer(derived.remainingMs)} />
                <SessionMetric label="Prossimo" value={derived.nextStep?.label ?? 'Nessuno'} />
              </div>
              <div className={`mt-4 h-3 overflow-hidden rounded-full ${copy.track}`}>
                <div className={`h-full rounded-full ${copy.fill}`} style={{ width: `${derived.progressPercentage}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {session.status === 'running' ? (
                <DrawerButton onClick={onPause} tone="primary" icon={Pause}>Pausa</DrawerButton>
              ) : session.status === 'paused' ? (
                <DrawerButton onClick={onResume} tone="primary" icon={Play}>Riprendi</DrawerButton>
              ) : (
                <DrawerButton onClick={onSaveJournal} tone="primary" icon={CheckCircle2}>Salva nel Diario</DrawerButton>
              )}
              {isActionable && <DrawerButton onClick={onCompleteStep} icon={CheckCircle2}>Completa step</DrawerButton>}
              {isActionable && <DrawerButton onClick={onSkipStep} icon={SkipForward}>Salta step</DrawerButton>}
              {isActionable && <DrawerButton onClick={onFinish}>Termina sessione</DrawerButton>}
              {!isActionable && <DrawerButton onClick={onClear}>Chiudi sessione</DrawerButton>}
              <DrawerButton onClick={onOpenDiary}>Apri Diario</DrawerButton>
            </div>

            <section className="mt-4 rounded-[18px] border border-ink/10 bg-white p-3 shadow-[0_8px_20px_rgba(50,46,43,0.05)]">
              <h3 className="text-base font-semibold text-ink">Avvisi step</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <ToggleRow
                  label="Notifica"
                  detail={notificationLabel}
                  enabled={notificationPermission === 'granted'}
                  onClick={onRequestNotifications}
                  enabledIcon={Bell}
                  disabledIcon={BellOff}
                />
                <ToggleRow
                  label="Suoni"
                  detail={session.soundEnabled ? 'Attivi' : 'Spenti'}
                  enabled={Boolean(session.soundEnabled)}
                  onClick={onToggleSound}
                  enabledIcon={Volume2}
                  disabledIcon={VolumeX}
                />
              </div>
            </section>

            <section className="mt-4">
              <h3 className="text-base font-semibold text-ink">Step</h3>
              <ol className="mt-2 grid gap-2">
                {session.stepSchedule.map((step, index) => (
                  <li key={step.stepId} className={`rounded-2xl border p-3 text-sm ${
                    step.stepId === derived.currentStep?.stepId && session.status !== 'completed'
                      ? 'border-crust/35 bg-crust/10'
                      : 'border-ink/10 bg-white'
                  }`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-ink">{index + 1}. {step.label}</span>
                      <span className={`shrink-0 ${copy.accent}`}>{formatDurationMinutes(step.durationMinutes)}</span>
                    </div>
                    {(step.completedAt || step.skippedAt) && (
                      <p className="mt-1 text-xs font-semibold text-ink/70">
                        {step.completedAt ? `Completato ${formatClock(step.completedAt)}` : `Saltato ${formatClock(step.skippedAt!)}`}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <div className="mt-4 rounded-2xl bg-cream/45 p-3 text-sm leading-5 text-ink/70">
              Pause registrate: {getSessionPauseMinutes(session)} min.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function DrawerButton({
  children,
  onClick,
  tone = 'secondary',
  icon: Icon,
  fullWidth = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'secondary';
  icon?: ComponentType<{ size?: number }>;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bp-focus mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
        fullWidth ? 'w-full' : ''
      } ${
        tone === 'primary'
          ? 'border-crust bg-crust text-cream hover:border-crust hover:bg-crust/90'
          : 'border-ink/10 bg-cream/45 text-ink/70 hover:border-crust/35 hover:bg-wheat-400/18 hover:text-ink'
      }`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  detail,
  enabled,
  onClick,
  enabledIcon: EnabledIcon,
  disabledIcon: DisabledIcon,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  onClick: () => void;
  enabledIcon: ComponentType<{ size?: number }>;
  disabledIcon: ComponentType<{ size?: number }>;
}) {
  const Icon = enabled ? EnabledIcon : DisabledIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="bp-focus flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream/30 px-3 py-2 text-left transition hover:border-crust/35 hover:bg-wheat-400/18"
      aria-pressed={enabled}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={16} />
        <span>
          <span className="block text-sm font-semibold text-ink">{label}</span>
          <span className="block text-xs font-medium text-ink/70">{detail}</span>
        </span>
      </span>
      <span className={`h-6 w-11 rounded-full p-1 transition ${enabled ? 'bg-crust' : 'bg-ink/25'}`}>
        <span className={`block h-4 w-4 rounded-full bg-cream transition ${enabled ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}
