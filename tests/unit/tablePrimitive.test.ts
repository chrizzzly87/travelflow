// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table } from '../../components/ui/table';

describe('ui Table primitive', () => {
  it('uses overscroll-behavior none on the scroll container', () => {
    render(
      React.createElement(
        Table,
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement('tr', null, React.createElement('td', null, 'cell')),
        ),
      ),
    );

    const tableNode = screen.getByRole('table');
    const container = tableNode.closest('[data-slot="table-container"]');
    expect(container).not.toBeNull();
    expect(container?.className).toContain('overscroll-none');
  });
});
