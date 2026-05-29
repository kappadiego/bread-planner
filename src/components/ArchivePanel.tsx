import {
  BookOpen,
  CalendarDays,
  Copy,
  FilePlus2,
  FolderOpen,
  History,
  Play,
  Save,
  Trash2,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { ArchiveState, ArchiveTab, JournalStatus } from '../archiveTypes';

type IconProps = {
  size?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

type IconComponent = ComponentType<IconProps>;

type JournalFormValues = {
  title: string;
  date: string;
  status: JournalStatus;
  resultLabel: string;
  initialNotes: string;
  finalNotes: string;
  nextAdjustment: string;
  sourceRecipeId: string;
  sourceTimelineId: string;
};

type ArchivePanelProps = {
  archive: ArchiveState;
  activeTab: ArchiveTab;
  activeRecipeId?: string;
  activeTimelineId?: string;
  archiveMessage: string;
  onTabChange: (tab: ArchiveTab) => void;
  onSaveRecipe: (name: string, notes: string, associatedTimelineId?: string) => void;
  onUpdateRecipe: (name: string, notes: string, associatedTimelineId?: string) => void;
  onSaveRecipeWithTimeline: (name: string, notes: string) => void;
  onLoadRecipe: (recipeId: string) => void;
  onDuplicateRecipe: (recipeId: string) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onCreateJournalFromRecipe: (recipeId: string) => void;
  onSaveTimeline: (name: string, notes: string) => void;
  onUpdateTimeline: (name: string, notes: string) => void;
  onLoadTimeline: (timelineId: string) => void;
  onDuplicateTimeline: (timelineId: string) => void;
  onDeleteTimeline: (timelineId: string) => void;
  onAssociateTimelineToRecipe: (timelineId: string, recipeId: string) => void;
  onCreateJournalFromTimeline: (timelineId: string, recipeId?: string) => void;
  onCreateJournalEntry: (values: JournalFormValues) => void;
  onUpdateJournalEntry: (entryId: string, values: JournalFormValues) => void;
  onDeleteJournalEntry: (entryId: string) => void;
  onLoadJournalSnapshot: (entryId: string) => void;
  onCreateTrialFromJournal: (entryId: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: number | string) =>
  new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));

const formatDurationMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const emptyJournalForm = (): JournalFormValues => ({
  title: '',
  date: today(),
  status: 'draft',
  resultLabel: '',
  initialNotes: '',
  finalNotes: '',
  nextAdjustment: '',
  sourceRecipeId: '',
  sourceTimelineId: '',
});

export function ArchivePanel({
  archive,
  activeTab,
  activeRecipeId,
  activeTimelineId,
  archiveMessage,
  onTabChange,
  onSaveRecipe,
  onUpdateRecipe,
  onSaveRecipeWithTimeline,
  onLoadRecipe,
  onDuplicateRecipe,
  onDeleteRecipe,
  onCreateJournalFromRecipe,
  onSaveTimeline,
  onUpdateTimeline,
  onLoadTimeline,
  onDuplicateTimeline,
  onDeleteTimeline,
  onAssociateTimelineToRecipe,
  onCreateJournalFromTimeline,
  onCreateJournalEntry,
  onUpdateJournalEntry,
  onDeleteJournalEntry,
  onLoadJournalSnapshot,
  onCreateTrialFromJournal,
}: ArchivePanelProps) {
  const [recipeName, setRecipeName] = useState('');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [associatedTimelineId, setAssociatedTimelineId] = useState('');
  const [timelineName, setTimelineName] = useState('');
  const [timelineNotes, setTimelineNotes] = useState('');
  const [timelineRecipeId, setTimelineRecipeId] = useState('');
  const [journalForm, setJournalForm] = useState<JournalFormValues>(emptyJournalForm);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);

  const activeRecipe = useMemo(
    () => archive.recipes.find((recipe) => recipe.id === activeRecipeId),
    [activeRecipeId, archive.recipes],
  );
  const activeTimeline = useMemo(
    () => archive.timelines.find((timeline) => timeline.id === activeTimelineId),
    [activeTimelineId, archive.timelines],
  );

  useEffect(() => {
    if (!activeRecipe) {
      return;
    }
    setRecipeName(activeRecipe.name);
    setRecipeNotes(activeRecipe.notes);
    setAssociatedTimelineId(activeRecipe.associatedTimelineId ?? '');
  }, [activeRecipe]);

  useEffect(() => {
    if (!activeTimeline) {
      return;
    }
    setTimelineName(activeTimeline.name);
    setTimelineNotes(activeTimeline.notes);
  }, [activeTimeline]);

  const submitRecipe = (mode: 'new' | 'update' | 'with-timeline') => {
    const safeName = recipeName.trim() || activeRecipe?.name || 'Ricetta senza nome';
    if (mode === 'update' && activeRecipeId) {
      onUpdateRecipe(safeName, recipeNotes, associatedTimelineId || undefined);
      return;
    }
    if (mode === 'with-timeline') {
      onSaveRecipeWithTimeline(safeName, recipeNotes);
      return;
    }
    onSaveRecipe(safeName, recipeNotes, associatedTimelineId || undefined);
  };

  const submitTimeline = (mode: 'new' | 'update') => {
    const safeName = timelineName.trim() || activeTimeline?.name || 'Timeline senza nome';
    if (mode === 'update' && activeTimelineId) {
      onUpdateTimeline(safeName, timelineNotes);
      return;
    }
    onSaveTimeline(safeName, timelineNotes);
  };

  const submitJournal = () => {
    if (editingJournalId) {
      onUpdateJournalEntry(editingJournalId, journalForm);
      setEditingJournalId(null);
      setJournalForm(emptyJournalForm());
      return;
    }
    onCreateJournalEntry(journalForm);
    setJournalForm(emptyJournalForm());
  };

  const editJournal = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    setEditingJournalId(entry.id);
    setJournalForm({
      title: entry.title,
      date: entry.date,
      status: entry.sessionData.status,
      resultLabel: entry.sessionData.resultLabel,
      initialNotes: entry.sessionData.initialNotes,
      finalNotes: entry.sessionData.finalNotes,
      nextAdjustment: entry.sessionData.nextAdjustment,
      sourceRecipeId: entry.sourceRecipeId ?? '',
      sourceTimelineId: entry.sourceTimelineId ?? '',
    });
    onTabChange('journal');
  };

  const viewCopy = {
    recipes: {
      title: 'Ricette',
      subtitle: 'Le formule che hai salvato per riusarle nel planner.',
      warning: 'Questi dati sono salvati nel browser. Se cancelli i dati del sito o cambi dispositivo, potresti non ritrovarli.',
    },
    timelines: {
      title: 'Timeline',
      subtitle: 'I processi di lavorazione che hai salvato per riusarli.',
      warning: 'Questi processi restano su questo dispositivo. In futuro il login permetterà la sincronizzazione.',
    },
    journal: {
      title: 'Diario',
      subtitle: 'Le tue prove reali: ricetta, timeline, condizioni, note e risultato.',
      warning: 'Il Diario salva snapshot delle prove: modificare una ricetta o una timeline dopo una prova non cambia il racconto già registrato.',
    },
  }[activeTab];

  return (
    <section className="bp-card rounded-[22px] p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-[30px] font-semibold tracking-normal text-ink">{viewCopy.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6f6257]">
            {viewCopy.subtitle}
          </p>
          <p className="mt-2 max-w-3xl rounded-2xl bg-wheat-50 px-3 py-2 text-sm leading-5 text-ink ring-1 ring-wheat-200">
            {viewCopy.warning}
          </p>
        </div>
      </div>

      {archiveMessage && (
        <p className="mt-4 rounded-2xl bg-cream/42 px-3 py-2 text-sm font-medium text-[#6f6257]">{archiveMessage}</p>
      )}

      {activeTab === 'recipes' && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,0.65fr)_minmax(0,1fr)]">
          <ArchiveForm title={activeRecipe ? `Ricetta attiva: ${activeRecipe.name}` : 'Salva ricetta'}>
            <TextInput label="Nome ricetta" value={recipeName} onChange={setRecipeName} placeholder={activeRecipe?.name ?? 'Focaccia alta idratazione'} />
            <TextArea label="Note opzionali" value={recipeNotes} onChange={setRecipeNotes} placeholder="Farina usata, obiettivo, osservazioni..." />
            <SelectInput
              label="Timeline associata"
              value={associatedTimelineId}
              onChange={setAssociatedTimelineId}
              options={[
                { value: '', label: 'Nessuna timeline' },
                ...archive.timelines.map((timeline) => ({ value: timeline.id, label: timeline.name })),
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => submitRecipe('new')} icon={Save}>Salva come nuova</ActionButton>
              <ActionButton onClick={() => submitRecipe('with-timeline')} icon={FilePlus2}>Salva ricetta + timeline</ActionButton>
              {activeRecipeId && <ActionButton onClick={() => submitRecipe('update')} icon={Save}>Aggiorna ricetta</ActionButton>}
            </div>
          </ArchiveForm>

          <div className="grid gap-3">
            {archive.recipes.length === 0 ? (
              <EmptyState text="Non hai ancora salvato ricette. Crea una formula nel planner e salvala per ritrovarla qui." />
            ) : archive.recipes.map((recipe) => (
              <ArchiveCard key={recipe.id} title={recipe.name} icon={BookOpen}>
                <p>{recipe.inputs.flourTotal}g farina · {recipe.inputs.hydration}% idratazione · {recipe.activeProfileId}</p>
                <p className="text-[#8d8176]">Aggiornata {formatDate(recipe.updatedAt)}</p>
                {recipe.notes && <p>{recipe.notes}</p>}
                <CardActions>
                  <MiniButton onClick={() => onLoadRecipe(recipe.id)}>Carica nel planner</MiniButton>
                  <MiniButton onClick={() => onDuplicateRecipe(recipe.id)} icon={Copy}>Duplica</MiniButton>
                  <MiniButton onClick={() => onCreateJournalFromRecipe(recipe.id)} icon={History}>Crea prova</MiniButton>
                  <MiniButton onClick={() => onDeleteRecipe(recipe.id)} icon={Trash2}>Elimina</MiniButton>
                </CardActions>
              </ArchiveCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'timelines' && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,0.65fr)_minmax(0,1fr)]">
          <ArchiveForm title={activeTimeline ? `Timeline attiva: ${activeTimeline.name}` : 'Salva timeline'}>
            <TextInput label="Nome timeline" value={timelineName} onChange={setTimelineName} placeholder={activeTimeline?.name ?? 'Focaccia overnight'} />
            <TextArea label="Note opzionali" value={timelineNotes} onChange={setTimelineNotes} placeholder="Processo, ambiente, organizzazione..." />
            <SelectInput
              label="Associa a ricetta"
              value={timelineRecipeId}
              onChange={setTimelineRecipeId}
              options={[
                { value: '', label: 'Scegli ricetta salvata' },
                ...archive.recipes.map((recipe) => ({ value: recipe.id, label: recipe.name })),
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => submitTimeline('new')} icon={Save}>Salva timeline</ActionButton>
              {activeTimelineId && <ActionButton onClick={() => submitTimeline('update')} icon={Save}>Aggiorna timeline</ActionButton>}
              {activeTimelineId && timelineRecipeId && (
                <ActionButton onClick={() => onAssociateTimelineToRecipe(activeTimelineId, timelineRecipeId)} icon={FilePlus2}>Associa a ricetta</ActionButton>
              )}
              <ActionButton onClick={() => onCreateJournalFromTimeline(activeTimelineId ?? '', timelineRecipeId || undefined)} icon={Play}>Crea prova</ActionButton>
            </div>
          </ArchiveForm>

          <div className="grid gap-3">
            {archive.timelines.length === 0 ? (
              <EmptyState text="Non hai ancora salvato timeline. Personalizza una timeline e salvala come processo riutilizzabile." />
            ) : archive.timelines.map((timeline) => (
              <ArchiveCard key={timeline.id} title={timeline.name} icon={CalendarDays}>
                <p>{timeline.steps.length} step · {formatDurationMinutes(timeline.totalDurationMinutes)} totali</p>
                <p className="text-[#8d8176]">Aggiornata {formatDate(timeline.updatedAt)}</p>
                {timeline.notes && <p>{timeline.notes}</p>}
                <CardActions>
                  <MiniButton onClick={() => onLoadTimeline(timeline.id)}>Usa nel piano</MiniButton>
                  <MiniButton onClick={() => onDuplicateTimeline(timeline.id)} icon={Copy}>Duplica</MiniButton>
                  <MiniButton onClick={() => onCreateJournalFromTimeline(timeline.id)} icon={History}>Crea prova</MiniButton>
                  <MiniButton onClick={() => onDeleteTimeline(timeline.id)} icon={Trash2}>Elimina</MiniButton>
                </CardActions>
              </ArchiveCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,0.65fr)_minmax(0,1fr)]">
          <ArchiveForm title={editingJournalId ? 'Modifica prova' : 'Registra prova'}>
            <TextInput label="Titolo prova" value={journalForm.title} onChange={(value) => setJournalForm((current) => ({ ...current, title: value }))} placeholder="Focaccia alta idratazione" />
            <TextInput label="Data" type="date" value={journalForm.date} onChange={(value) => setJournalForm((current) => ({ ...current, date: value }))} />
            <SelectInput
              label="Stato"
              value={journalForm.status}
              onChange={(value) => setJournalForm((current) => ({ ...current, status: value as JournalStatus }))}
              options={[
                { value: 'draft', label: 'Bozza' },
                { value: 'active', label: 'Attiva' },
                { value: 'scheduled', label: 'Programmata' },
                { value: 'completed', label: 'Completata' },
              ]}
            />
            <SelectInput
              label="Ricetta sorgente"
              value={journalForm.sourceRecipeId}
              onChange={(value) => setJournalForm((current) => ({ ...current, sourceRecipeId: value }))}
              options={[{ value: '', label: 'Planner corrente' }, ...archive.recipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))]}
            />
            <SelectInput
              label="Timeline sorgente"
              value={journalForm.sourceTimelineId}
              onChange={(value) => setJournalForm((current) => ({ ...current, sourceTimelineId: value }))}
              options={[{ value: '', label: 'Timeline corrente' }, ...archive.timelines.map((timeline) => ({ value: timeline.id, label: timeline.name }))]}
            />
            <TextInput label="Risultato" value={journalForm.resultLabel} onChange={(value) => setJournalForm((current) => ({ ...current, resultLabel: value }))} placeholder="Buona, da migliorare..." />
            <TextArea label="Note" value={journalForm.finalNotes} onChange={(value) => setJournalForm((current) => ({ ...current, finalNotes: value }))} />
            <TextArea label="Cosa cambiare la prossima volta" value={journalForm.nextAdjustment} onChange={(value) => setJournalForm((current) => ({ ...current, nextAdjustment: value }))} />
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={submitJournal} icon={History}>{editingJournalId ? 'Aggiorna prova' : 'Salva nel Diario'}</ActionButton>
              {editingJournalId && <ActionButton onClick={() => { setEditingJournalId(null); setJournalForm(emptyJournalForm()); }} icon={RotateIcon}>Annulla</ActionButton>}
            </div>
          </ArchiveForm>

          <div className="grid gap-3">
            {archive.journal.length === 0 ? (
              <EmptyState text="Non hai ancora registrato prove. Quando prepari un impasto, salva una prova con ricetta, timeline, temperatura, note e risultato." />
            ) : archive.journal.map((entry) => (
              <ArchiveCard key={entry.id} title={entry.title} icon={History}>
                <p className="text-[#8d8176]">{formatDate(entry.date)}</p>
                <p>Risultato: {entry.sessionData.resultLabel || 'non indicato'}</p>
                {entry.sessionData.finalNotes && <p>{entry.sessionData.finalNotes}</p>}
                {entry.sessionData.nextAdjustment && <p>Prossima volta: {entry.sessionData.nextAdjustment}</p>}
                <p className="text-[#8d8176]">
                  {entry.recipeSnapshot.name} · {entry.timelineSnapshot?.name ?? 'Piano da completare'} · {entry.recipeSnapshot.inputs.hydration}% idratazione · {entry.sessionData.ambientTemperature}
                </p>
                <CardActions>
                  <MiniButton onClick={() => editJournal(entry.id)}>Apri</MiniButton>
                  <MiniButton onClick={() => onCreateTrialFromJournal(entry.id)} icon={FilePlus2}>Crea nuova prova</MiniButton>
                  <MiniButton onClick={() => onLoadJournalSnapshot(entry.id)} icon={FolderOpen}>Carica nel planner</MiniButton>
                  <MiniButton onClick={() => onDeleteJournalEntry(entry.id)} icon={Trash2}>Elimina</MiniButton>
                </CardActions>
              </ArchiveCard>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ArchiveForm({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function ArchiveCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: IconComponent;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 text-sm leading-5 text-[#6f6257] shadow-inner-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream text-crust ring-1 ring-crust/15">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <div className="mt-2 grid gap-1">{children}</div>
        </div>
      </div>
    </article>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-10 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium text-ink outline-none placeholder:text-[#9b9188] focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      <textarea
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="rounded-2xl border border-[#322e2b24] bg-white px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-[#9b9188] focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-10 rounded-2xl border border-[#322e2b24] bg-white px-3 text-sm font-medium text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: ReactNode;
  icon: IconComponent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-crust/25 bg-cream px-3 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)]"
    >
      <Icon size={16} aria-hidden="true" />
      {children}
    </button>
  );
}

function MiniButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: ReactNode;
  icon?: IconComponent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-[#322e2b24] bg-white px-3 text-sm font-semibold text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/45 hover:text-ink"
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

function CardActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#322e2b2e] bg-cream/30 px-4 py-8 text-center text-sm leading-6 text-[#6f6257]">
      {text}
    </div>
  );
}

function RotateIcon({ size = 16, ...props }: { size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return <History size={size} {...props} />;
}
