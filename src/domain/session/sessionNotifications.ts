import type { ActiveSession } from './activeSessionTypes';

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export const getBrowserNotificationPermission = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
};

export const requestBrowserNotificationPermission = async (): Promise<BrowserNotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
};

export const sendBrowserStepNotification = (title: string, body: string) => {
  if (getBrowserNotificationPermission() !== 'granted') {
    return;
  }

  try {
    new Notification(title, { body });
  } catch {
    // Browser notifications are best-effort and should never break the timer flow.
  }
};

export const playStepSound = () => {
  try {
    const AudioContextClass = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 680;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.18);
  } catch {
    // Audio can be blocked by the browser if the user has not interacted.
  }
};

export const getSessionDocumentTitle = (session?: ActiveSession) => {
  if (!session) {
    return 'Bread Planner';
  }

  if (session.status === 'completed') {
    return 'Sessione completata · Bread Planner';
  }
  if (session.status === 'paused') {
    return 'Timer in pausa · Bread Planner';
  }
  return 'Impasto in corso · Bread Planner';
};
