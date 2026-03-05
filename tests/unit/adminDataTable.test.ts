import { describe, expect, it } from 'vitest';
import {
  ADMIN_TABLE_SORTED_CELL_CLASS,
  ADMIN_TABLE_SORTED_HEADER_CLASS,
  getAdminStickyBodyCellClass,
  getAdminStickyHeaderCellClass,
} from '../../components/admin/AdminDataTable';

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

    expect(trailingHeaderClass).toContain('border-r');
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
});
