// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MessageAction } from '../../components/ai-elements/message';
import { PromptInputButton } from '../../components/ai-elements/prompt-input';

// Radix Tooltip never opens under preact/compat (the app's runtime), but it does
// under the real React these tests run on, so a "tooltip opens" test here would
// pass either way. Assert instead that the buttons hand their label to the app's
// GlobalTooltipLayer via `data-tooltip` and that nothing brings Radix Tooltip back.
describe('ai-elements tooltips', () => {
  it('MessageAction puts its tooltip on the button as data-tooltip', () => {
    render(<MessageAction tooltip="Copy message">C</MessageAction>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('data-tooltip')).toBe('Copy message');
    expect(button.hasAttribute('data-state')).toBe(false);
  });

  it('MessageAction without a tooltip renders no data-tooltip', () => {
    render(<MessageAction label="Copy">C</MessageAction>);
    expect(screen.getByRole('button').hasAttribute('data-tooltip')).toBe(false);
  });

  it('PromptInputButton accepts a string tooltip', () => {
    render(<PromptInputButton tooltip="Attach file">A</PromptInputButton>);
    expect(screen.getByRole('button').getAttribute('data-tooltip')).toBe('Attach file');
  });

  it('PromptInputButton appends the shortcut to an object tooltip', () => {
    render(<PromptInputButton tooltip={{ content: 'Attach file', shortcut: '⌘U' }}>A</PromptInputButton>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('data-tooltip')).toBe('Attach file (⌘U)');
    expect(button.hasAttribute('data-state')).toBe(false);
  });

  it('no source file imports Radix Tooltip', () => {
    const root = path.resolve(__dirname, '../..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.git', '.netlify', 'tests', 'test'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (/components\/ui\/tooltip['"]|@radix-ui\/react-tooltip|\bTooltip\b[^;]*from ['"]radix-ui['"]/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    for (const dir of ['components', 'pages', 'services', 'shared', 'hooks', 'lib', 'contexts']) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }
    expect(fs.existsSync(path.join(root, 'components/ui/tooltip.tsx'))).toBe(false);
    expect(offenders).toEqual([]);
  });
});
