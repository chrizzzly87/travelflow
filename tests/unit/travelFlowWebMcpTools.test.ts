import { describe, expect, it, vi } from 'vitest';
import {
  createTravelFlowWebMcpTools,
  registerTravelFlowWebMcpTools,
  resolveModelContext,
  type WebMcpTool,
} from '../../app/webmcp/travelFlowWebMcpTools';

describe('resolveModelContext', () => {
  it('prefers document.modelContext and falls back to navigator.modelContext', () => {
    const fromDocument = { registerTool: vi.fn() };
    const fromNavigator = { registerTool: vi.fn() };
    expect(resolveModelContext({ document: { modelContext: fromDocument }, navigator: { modelContext: fromNavigator } })).toBe(fromDocument);
    expect(resolveModelContext({ document: {}, navigator: { modelContext: fromNavigator } })).toBe(fromNavigator);
    expect(resolveModelContext({ document: {}, navigator: {} })).toBeNull();
    expect(resolveModelContext({ document: { modelContext: {} } })).toBeNull();
  });
});

describe('TravelFlow WebMCP tools', () => {
  const byName = (tools: WebMcpTool[], name: string) => tools.find(tool => tool.name === name)!;

  it('offers only draft tools, never trip generation', () => {
    const tools = createTravelFlowWebMcpTools({ navigate: vi.fn(), fetchImpl: vi.fn() });
    expect(tools.map(tool => tool.name)).toEqual(['get_trip_draft_schema', 'validate_trip_draft', 'create_trip_draft']);
    expect(byName(tools, 'get_trip_draft_schema').annotations?.readOnlyHint).toBe(true);
  });

  it('creates a draft through the API, tags it as WebMCP and opens it', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, draftId: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', url: 'https://x/draft/drf_AAAAAAAAAAAAAAAAAAAAAAAA' }, { status: 201 }));
    const navigate = vi.fn();
    const onDraftCreated = vi.fn();
    const tool = byName(createTravelFlowWebMcpTools({ fetchImpl: fetchImpl as unknown as typeof fetch, navigate, onDraftCreated }), 'create_trip_draft');

    const text = await tool.execute({ trip: { tripTitle: 'x' } });

    const [path, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/trip-drafts');
    expect((init.headers as Record<string, string>)['X-TravelFlow-Draft-Source']).toBe('webmcp');
    expect(JSON.parse(String(init.body))).toEqual({ trip: { tripTitle: 'x' } });
    expect(navigate).toHaveBeenCalledWith('/draft/drf_AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(onDraftCreated).toHaveBeenCalledWith('drf_AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(JSON.parse(text).message).toContain('Draft created');
  });

  it('returns validation errors as text and does not navigate', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: false, code: 'validation_failed', errors: ['cities must be an array'] }, { status: 422 }));
    const navigate = vi.fn();
    const tool = byName(createTravelFlowWebMcpTools({ fetchImpl: fetchImpl as unknown as typeof fetch, navigate }), 'create_trip_draft');
    const text = await tool.execute({ trip: {} });
    expect(JSON.parse(text).errors).toEqual(['cities must be an array']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('registers each tool with the abort signal and survives duplicate registrations', () => {
    const registerTool = vi.fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => { throw new DOMException('duplicate', 'InvalidStateError'); });
    const controller = new AbortController();
    expect(registerTravelFlowWebMcpTools(controller.signal, { navigate: vi.fn() }, { registerTool })).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(registerTool.mock.calls[0][1]).toEqual({ signal: controller.signal });
    expect(registerTravelFlowWebMcpTools(controller.signal, { navigate: vi.fn() }, null)).toBe(false);
  });
});
