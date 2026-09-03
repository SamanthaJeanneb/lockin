import { describe, expect, it } from 'vitest';
import {
  boardColumnsVisible, breakpointFor, contextPaneMode, isAtLeast, roadmapMonths,
} from '@/lib/breakpoints';

describe('breakpointFor', () => {
  it('maps the four boundaries in the spec exactly', () => {
    expect(breakpointFor(375)).toBe('phone');
    expect(breakpointFor(767)).toBe('phone');
    expect(breakpointFor(768)).toBe('tablet');
    expect(breakpointFor(1023)).toBe('tablet');
    expect(breakpointFor(1024)).toBe('compact');
    expect(breakpointFor(1199)).toBe('compact');
    expect(breakpointFor(1200)).toBe('standard');
    expect(breakpointFor(1439)).toBe('standard');
    expect(breakpointFor(1440)).toBe('wide');
    expect(breakpointFor(2560)).toBe('wide');
  });
});

describe('contextPaneMode', () => {
  it('docks at compact and above, drawers on tablet, routes on phone', () => {
    expect(contextPaneMode('wide')).toBe('docked');
    expect(contextPaneMode('standard')).toBe('docked');
    expect(contextPaneMode('compact')).toBe('docked');
    expect(contextPaneMode('tablet')).toBe('drawer');
    expect(contextPaneMode('phone')).toBe('route');
  });
});

describe('responsive degradation contracts', () => {
  it('shows six board columns wide and one on a phone', () => {
    expect(boardColumnsVisible('wide')).toBe(6);
    expect(boardColumnsVisible('standard')).toBe(5);
    expect(boardColumnsVisible('tablet')).toBe(3);
    expect(boardColumnsVisible('phone')).toBe(1);
  });

  it('shows twelve roadmap months wide, six between, none on a phone', () => {
    expect(roadmapMonths('wide')).toBe(12);
    expect(roadmapMonths('standard')).toBe(6);
    expect(roadmapMonths('phone')).toBe(0);
  });
});

describe('isAtLeast', () => {
  it('orders the scale', () => {
    expect(isAtLeast('wide', 'compact')).toBe(true);
    expect(isAtLeast('tablet', 'compact')).toBe(false);
    expect(isAtLeast('compact', 'compact')).toBe(true);
  });
});
