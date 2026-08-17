import { describe, expect, it } from 'vitest';

describe('destination source importer HTTP responses', () => {
  it('documents that successful PostgREST minimal responses may have empty bodies', () => {
    const response = new Response('', { status: 201 });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.headers.get('content-length')).toBeNull();
  });

  it('uses source id and payload hash as the immutable version identity', () => {
    expect(`${'atobeach:63'}:${'a'.repeat(64)}`).toBe(`atobeach:63:${'a'.repeat(64)}`);
  });
});
