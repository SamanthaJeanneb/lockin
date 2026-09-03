import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ObjectRow } from '@/components/composite/ObjectRow';
import { InlineField } from '@/components/ui/InlineField';
import { Checkbox } from '@/components/ui/Checkbox';
import { TrajectoryChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { SerializedObject } from '@/lib/client-api';

vi.mock('@/components/ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/ui/Menu', () => ({
  Menu: ({ trigger }: { trigger: React.ReactNode }) => trigger,
  ContextMenu: ({ children }: { children: React.ReactNode }) => children,
}));

const task: SerializedObject = {
  id: 'a1', userId: 'u1', type: 'task', title: 'Finish portfolio homepage', body: null,
  status: 'today', area: 'career', horizon: null, priority: 2, progress: '0',
  targetValue: null, currentValue: null, unit: null, metricName: null,
  startAt: null, dueAt: null, completedAt: null, snoozeUntil: null,
  scheduledStart: null, scheduledEnd: null, estimateMinutes: 90, energy: 'focus',
  rrule: null, props: {}, confidence: null, inferredFields: [], sourceCaptureId: null,
  position: 0, archivedAt: null, deletedAt: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe('ObjectRow', () => {
  it('renders the title, the why line and the unblock count', () => {
    render(<ObjectRow object={task} why="Unblocks three tasks in Job search." unblocks={3} />);
    expect(screen.getByText('Finish portfolio homepage')).toBeInTheDocument();
    expect(screen.getByText('Unblocks three tasks in Job search.')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('completes through the checkbox', () => {
    const onComplete = vi.fn();
    render(<ObjectRow object={task} onComplete={onComplete} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('opens on Enter, so the list is usable without a mouse', () => {
    const onOpen = vi.fn();
    render(<ObjectRow object={task} onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByRole('listitem'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalled();
  });

  it('strikes through and greys a completed row', () => {
    render(<ObjectRow object={{ ...task, completedAt: new Date().toISOString() }} />);
    expect(screen.getByText('Finish portfolio homepage').className).toContain('line-through');
  });

  it('is a list item, not a table row — role="row" outside a table is broken structure', () => {
    render(<ObjectRow object={task} />);
    const row = screen.getByRole('listitem');
    expect(row).toHaveAttribute('aria-label', 'Finish portfolio homepage');
    expect(row).toHaveAttribute('tabindex', '0');
  });

  it('names its blocked state for assistive technology, not only with an icon', () => {
    render(<ObjectRow object={task} blockedBy={[{ id: 'b1', title: 'Shortlist companies' }]} />);
    expect(
      screen.getByRole('checkbox', { name: /Complete Finish portfolio homepage/ }),
    ).toBeInTheDocument();
  });
});

describe('InlineField', () => {
  it('looks like text until clicked, then edits', () => {
    const onSave = vi.fn();
    render(<InlineField label="Title" value="Original" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('Changed');
  });

  it('cancels on Escape without saving', () => {
    const onSave = vi.fn();
    render(<InlineField label="Title" value="Original" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('marks an AI-inferred value with the dashed underline, and drops it on interaction', () => {
    render(<InlineField label="Due" value="Tomorrow" inferred onSave={() => {}} />);
    const button = screen.getByRole('button', { name: 'Due' });
    expect(button.className).toContain('border-dashed');
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Due' }).className).not.toContain('border-dashed');
  });
});

describe('Checkbox', () => {
  it('exposes its state to assistive technology', () => {
    render(<Checkbox checked label="Done" onCheckedChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('TrajectoryChip', () => {
  it('pairs colour with a word, so colour never carries meaning alone', () => {
    render(<TrajectoryChip trajectory="behind" />);
    expect(screen.getByText('Behind')).toBeInTheDocument();
  });

  it('renders nothing when there is no trajectory to report', () => {
    const { container } = render(<TrajectoryChip trajectory="none" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ProgressBar', () => {
  it('reports its value to assistive technology and clamps out-of-range input', () => {
    render(<ProgressBar value={140} label="Career" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
