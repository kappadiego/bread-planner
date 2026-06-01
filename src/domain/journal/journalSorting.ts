import type { JournalEntry, JournalStatus } from '../../archiveTypes';

const statusSortRank: Record<JournalStatus, number> = {
  scheduled: 0,
  draft: 1,
  active: 2,
  completed: 3,
};

const getJournalDateSortValue = (entry: JournalEntry) => {
  const parsedDate = new Date(`${entry.date}T00:00:00`).getTime();
  return Number.isNaN(parsedDate) ? entry.updatedAt : parsedDate;
};

export const sortJournalEntries = (entries: JournalEntry[], currentJournalEntryId?: string) =>
  [...entries].sort((first, second) => {
    if (first.id === currentJournalEntryId && second.id !== currentJournalEntryId) {
      return -1;
    }
    if (second.id === currentJournalEntryId && first.id !== currentJournalEntryId) {
      return 1;
    }

    const firstRank = statusSortRank[first.sessionData.status] ?? 4;
    const secondRank = statusSortRank[second.sessionData.status] ?? 4;
    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    const dateDelta = getJournalDateSortValue(second) - getJournalDateSortValue(first);
    return dateDelta || second.updatedAt - first.updatedAt;
  });
