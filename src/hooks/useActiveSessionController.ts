import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveSession } from '../domain/session/activeSessionTypes';
import {
  activeSessionToTimerState,
  completeActiveSession,
  completeActiveSessionStep,
  markActiveSessionNotificationAsked,
  normalizeActiveSession,
  pauseActiveSession,
  resumeActiveSession,
  setActiveSessionSoundEnabled,
  skipActiveSessionStep,
} from '../domain/session/activeSessionUtils';
import {
  getActiveSessionBlockingMessage,
  isBlockingLiveSession,
} from '../domain/session/sessionGuards';
import {
  getBrowserNotificationPermission,
  getSessionDocumentTitle,
  playStepSound,
  requestBrowserNotificationPermission,
  sendBrowserStepNotification,
  type BrowserNotificationPermission,
} from '../domain/session/sessionNotifications';

export function useActiveSessionController(initialActiveSession?: ActiveSession) {
  const [activeSession, setActiveSession] = useState<ActiveSession | undefined>(initialActiveSession);
  const [isActiveSessionDrawerOpen, setIsActiveSessionDrawerOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission,
  );
  const lastSessionStepRef = useRef<string | undefined>(activeSession?.currentStepId);
  const activeSessionTimer = useMemo(() => activeSessionToTimerState(activeSession), [activeSession]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveSession((current) => (current ? normalizeActiveSession(current) : current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    document.title = getSessionDocumentTitle(activeSession);
    return () => {
      document.title = 'Bread Planner';
    };
  }, [activeSession]);

  useEffect(() => {
    const currentStepId = activeSession?.currentStepId;
    if (!activeSession) {
      lastSessionStepRef.current = currentStepId;
      return;
    }

    if (activeSession.status !== 'running') {
      lastSessionStepRef.current = currentStepId;
      return;
    }

    const previousStepId = lastSessionStepRef.current;
    if (previousStepId && currentStepId && previousStepId !== currentStepId) {
      const nextStep = activeSession.stepSchedule.find((step) => step.stepId === currentStepId);
      const message = nextStep
        ? `Ora tocca a ${nextStep.label}.`
        : 'Controlla il prossimo passaggio.';
      sendBrowserStepNotification('Bread Planner', message);
      if (activeSession.soundEnabled) {
        playStepSound();
      }
    }

    lastSessionStepRef.current = currentStepId;
  }, [activeSession]);

  const updateActiveSessionState = (updater: (session: ActiveSession) => ActiveSession) => {
    setActiveSession((current) => (current ? updater(current) : current));
  };

  const requestActiveSessionNotifications = () => {
    requestBrowserNotificationPermission().then((permission) => {
      setNotificationPermission(permission);
      setActiveSession((current) => (current ? markActiveSessionNotificationAsked(current) : current));
    });
  };

  const startLiveSession = (session: ActiveSession) => {
    if (isBlockingLiveSession(activeSession)) {
      return {
        ok: false,
        message: getActiveSessionBlockingMessage(activeSession),
      };
    }

    setActiveSession(session);
    setIsActiveSessionDrawerOpen(true);
    const browserPermission = getBrowserNotificationPermission();
    setNotificationPermission(browserPermission);

    if (!session.notificationPermissionAsked && browserPermission === 'default') {
      requestBrowserNotificationPermission().then((permission) => {
        setNotificationPermission(permission);
        setActiveSession((current) => (current ? markActiveSessionNotificationAsked(current) : current));
      });
    }

    return { ok: true, message: '' };
  };

  const clearActiveSession = (confirmRunning = true) => {
    if (
      confirmRunning &&
      activeSession &&
      activeSession.status !== 'completed' &&
      !window.confirm('Interrompere la sessione attiva?')
    ) {
      return false;
    }
    setActiveSession(undefined);
    setIsActiveSessionDrawerOpen(false);
    return true;
  };

  return {
    activeSession,
    setActiveSession,
    activeSessionTimer,
    isActiveSessionDrawerOpen,
    setIsActiveSessionDrawerOpen,
    openActiveSessionDrawer: () => setIsActiveSessionDrawerOpen(true),
    closeActiveSessionDrawer: () => setIsActiveSessionDrawerOpen(false),
    notificationPermission,
    canStartNewLiveSession: !isBlockingLiveSession(activeSession),
    getBlockingActiveSessionMessage: () => getActiveSessionBlockingMessage(activeSession),
    startLiveSession,
    pauseCurrentActiveSession: () => updateActiveSessionState((session) => pauseActiveSession(session)),
    resumeCurrentActiveSession: () => updateActiveSessionState((session) => resumeActiveSession(session)),
    skipCurrentActiveSessionStep: () => updateActiveSessionState((session) => skipActiveSessionStep(session)),
    completeCurrentActiveSessionStep: () => updateActiveSessionState((session) => completeActiveSessionStep(session)),
    finishCurrentActiveSession: () => updateActiveSessionState((session) => completeActiveSession(session)),
    clearActiveSession,
    requestActiveSessionNotifications,
    toggleActiveSessionSound: () => {
      updateActiveSessionState((session) => setActiveSessionSoundEnabled(session, !session.soundEnabled));
    },
  };
}
