import { describe, expect, it } from 'vitest';
import {
  buildRunnableBenchmarkTargets,
  getAllSelectedBenchmarkTargetIds,
  pruneInactiveBenchmarkTargetIds,
  toggleInactiveBenchmarkTargetId,
  type AiBenchmarkTargetModel,
} from '../../utils/aiBenchmarkTargets';

describe('utils/aiBenchmarkTargets', () => {
  it('toggles inactive target ids on and off', () => {
    const initial = ['model-a'];
    const added = toggleInactiveBenchmarkTargetId(initial, 'model-b');
    const removed = toggleInactiveBenchmarkTargetId(added, 'model-a');

    expect(added).toEqual(['model-a', 'model-b']);
    expect(removed).toEqual(['model-b']);
  });

  it('prunes inactive ids that are no longer selected targets', () => {
    const next = pruneInactiveBenchmarkTargetIds(
      ['model-a', 'model-b', 'model-c'],
      ['model-b', 'model-d']
    );

    expect(next).toEqual(['model-b']);
  });

  it('returns runnable targets excluding inactive selections', () => {
    const selectedTargets: AiBenchmarkTargetModel[] = [
      { id: 'a', provider: 'openai', model: 'openai/gpt-5-mini', label: 'GPT 5 mini' },
      { id: 'b', provider: 'perplexity', model: 'perplexity/sonar', label: 'Sonnar' },
      { id: 'c', provider: 'qwen', model: 'qwen/qwen-3.5-plus', label: 'Qwen 3.5 Plus' },
    ];

    const runnable = buildRunnableBenchmarkTargets(selectedTargets, ['b']);

    expect(runnable).toEqual([
      { provider: 'openai', model: 'openai/gpt-5-mini', label: 'GPT 5 mini' },
      { provider: 'qwen', model: 'qwen/qwen-3.5-plus', label: 'Qwen 3.5 Plus' },
    ]);
  });

  it('returns unique selected target ids in order for deactivate-all actions', () => {
    const selected = getAllSelectedBenchmarkTargetIds([
      { id: 'model-a' },
      { id: 'model-b' },
      { id: 'model-a' },
      { id: 'model-c' },
    ]);

    expect(selected).toEqual(['model-a', 'model-b', 'model-c']);
  });
});
