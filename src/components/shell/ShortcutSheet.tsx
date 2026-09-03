'use client';
import { useApp } from '@/lib/store';
import { Dialog, Kbd, SectionHeader } from '@/components/ui';

const GLOBAL = [
  ['⌘K', 'Command palette — capture, search and navigate in one field'],
  ['C', 'Capture directly'],
  ['D', 'Debrief (evening close)'],
  ['/', 'Focus search'],
  ['G then H/G/W/B/P/L/F/M', 'Go to Home, Goals, Work, Brain, People, Library, Life, Money'],
  ['⌘\\', 'Toggle sidebar'],
  ['Esc', 'Close context pane, modal, or cancel edit'],
  ['?', 'This sheet'],
];

const LIST = [
  ['J / K or ↑ ↓', 'Move selection'],
  ['Enter', 'Open in context pane'],
  ['X', 'Toggle select'],
  ['E', 'Complete'],
  ['S', 'Snooze menu'],
  ['T', 'Move to Today'],
  ['1–4', 'Set priority'],
  ['⌘Z', 'Undo'],
];

export function ShortcutSheet() {
  const modal = useApp((s) => s.modal);
  const close = useApp((s) => s.closeModal);

  return (
    <Dialog
      open={modal === 'shortcuts'}
      onOpenChange={(o) => !o && close()}
      title="Keyboard shortcuts"
      size="md"
    >
      <div className="px-xl py-lg">
        <SectionHeader title="Global" size="micro" as="h3" />
        <Table rows={GLOBAL} />
        <div className="h-xl" />
        <SectionHeader title="In lists and boards" size="micro" as="h3" />
        <Table rows={LIST} />
      </div>
    </Dialog>
  );
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([key, desc]) => (
          <tr key={key} className="border-b border-hairline">
            <td className="w-[200px] py-sm align-top">
              <Kbd>{key}</Kbd>
            </td>
            <td className="t-body-sm py-sm text-ink-muted">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
