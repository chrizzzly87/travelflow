// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminSortHeaderButton } from '../../components/admin/AdminDataTable';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_TABLE_SORTED_CELL_CLASS,
  ADMIN_TABLE_SORTED_HEADER_CLASS,
  getAdminStickyBodyCellClass,
  getAdminStickyHeaderCellClass,
} from '../../components/admin/AdminDataTableUtils';

describe('admin data table sticky class helpers', () => {
  it('preserves sticky positioning by not forcing relative position on sticky cells', () => {
    const firstStickyHeaderClass = getAdminStickyHeaderCellClass({
      isScrolled: false,
      isFirst: true,
    });
    const firstStickyBodyClass = getAdminStickyBodyCellClass({
      isSelected: false,
      isScrolled: false,
      isFirst: true,
    });

    expect(firstStickyHeaderClass).not.toContain('relative');
    expect(firstStickyBodyClass).not.toContain('relative');
  });

  it('adds trailing separator/shadow classes only to the trailing sticky column', () => {
    const trailingHeaderClass = getAdminStickyHeaderCellClass({
      isScrolled: true,
      isFirst: false,
      isSorted: true,
    });

    expect(trailingHeaderClass).toContain('border-e');
    expect(trailingHeaderClass).toContain('shadow-');
    expect(trailingHeaderClass).toContain(ADMIN_TABLE_SORTED_HEADER_CLASS);
  });

  it('applies sorted cell class marker to sorted body cells', () => {
    const sortedBodyClass = getAdminStickyBodyCellClass({
      isSelected: false,
      isScrolled: false,
      isFirst: false,
      isSorted: true,
    });

    expect(sortedBodyClass).toContain('bg-accent-50');
    expect(sortedBodyClass).not.toContain(ADMIN_TABLE_SORTED_CELL_CLASS.split(' ')[0]);
  });

  it('keeps sticky tints opaque in dark mode so scrolled columns never show through', () => {
    const selected = getAdminStickyBodyCellClass({ isSelected: true, isScrolled: true, isFirst: true });
    const sortedHeader = getAdminStickyHeaderCellClass({ isScrolled: true, isFirst: true, isSorted: true });

    for (const className of [selected, sortedHeader]) {
      expect(className).not.toMatch(/dark:bg-accent-400\/12/);
      expect(className).toMatch(/dark:bg-\[color-mix\(in_oklab,var\(--tf-accent-400\)_12%,var\(--(card|secondary)\)\)\]/);
    }
  });

  it('uses logical edges so the frozen column divider follows the reading direction', () => {
    const trailing = getAdminStickyBodyCellClass({ isSelected: false, isScrolled: true, isFirst: false });
    expect(trailing).toContain('border-e');
    expect(trailing).toContain('before:end-0');
    expect(trailing).toContain('after:-end-3');
    expect(trailing).not.toMatch(/border-r\b|before:right-0|after:-right-3/);
  });

  it('labels sort headers through the shared tooltip layer, not a native title', () => {
    render(React.createElement(AdminSortHeaderButton, { label: 'Owner', isActive: true, direction: 'asc', onClick: () => {} }));
    const button = screen.getByRole('button', { name: 'Owner' });
    expect(button).toHaveAttribute('data-tooltip', 'Sort by Owner');
    expect(button).not.toHaveAttribute('title');
    expect(button).toHaveAttribute('data-state', 'asc');
  });
});
