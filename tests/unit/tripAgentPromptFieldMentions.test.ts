import { describe, expect, it } from 'vitest';

import { mentionAtCaret, removeMention } from '../../components/trip-agent/TripAgentPromptField';

describe('removeMention', () => {
  it('takes the space after a mention with it', () => {
    const text = 'Stays in @Taipei in three ranges';
    const start = text.indexOf('@Taipei');
    expect(removeMention(text, { start, end: start + 7 })).toEqual({ value: 'Stays in in three ranges', caret: start });
  });

  it('takes the space before a mention that ends the text', () => {
    const text = 'Plan a day trip from @Porto';
    const start = text.indexOf('@Porto');
    expect(removeMention(text, { start, end: text.length })).toEqual({ value: 'Plan a day trip from', caret: start - 1 });
  });
});

describe('mentionAtCaret', () => {
  const spans = [{ start: 9, end: 16, label: 'Taipei' }];

  it('finds the mention from its "@" up to its last letter', () => {
    expect(mentionAtCaret(spans, 9)?.label).toBe('Taipei');
    expect(mentionAtCaret(spans, 15)?.label).toBe('Taipei');
  });

  it('leaves the caret just after a mention free for typing', () => {
    expect(mentionAtCaret(spans, 16)).toBeUndefined();
  });
});
