import { canUseLocalStorage } from './storageAvailability';

export const readLocalStorageItem = (key: string): string | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocalStorageItem = (key: string, value: string): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can fail in private mode or when quota is full; the app should keep working.
  }
};

export const removeLocalStorageItem = (key: string): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors: clearing local memory should never break the app.
  }
};
