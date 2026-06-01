import type { ActiveSession } from './activeSessionTypes';

export const isLiveActiveSession = (session?: ActiveSession): session is ActiveSession =>
  Boolean(session && (
    session.status === 'running' ||
    session.status === 'paused' ||
    session.status === 'completed'
  ));

export const isBlockingLiveSession = (session?: ActiveSession): session is ActiveSession =>
  isLiveActiveSession(session);

export const getActiveSessionRecipeName = (session?: ActiveSession) =>
  session?.recipeSnapshot.name ||
  session?.recipeSnapshot.customProfileName ||
  'questa ricetta';

export const getActiveSessionBlockingMessage = (session?: ActiveSession) => {
  if (!isBlockingLiveSession(session)) {
    return '';
  }

  const recipeName = getActiveSessionRecipeName(session);
  if (session.status === 'completed') {
    return `La sessione di ${recipeName} è completata ma non è ancora salvata. Salvala nel Diario o chiudila prima di avviarne un’altra.`;
  }

  return `C’è già una sessione in corso: ${recipeName}. Puoi continuare a pianificare questa ricetta, ma per avviarla devi prima completare o salvare la sessione attiva.`;
};
