import { describe, expect, it } from 'vitest';
import {
  TRIP_ITINERARY_JSON_SCHEMA,
  TRIP_ITINERARY_SCHEMA_NAME,
  TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA,
} from '../../shared/aiTripItinerarySchema.ts';

const OPENAI_STRICT_SCHEMA_UNSUPPORTED_KEYS = [
  '$ref',
  '$defs',
  'definitions',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const visitSchema = (
  node: unknown,
  path: string,
  visitor: (schemaNode: Record<string, unknown>, path: string) => void,
) => {
  if (!isRecord(node)) return;

  visitor(node, path);

  if (isRecord(node.properties)) {
    for (const [key, value] of Object.entries(node.properties)) {
      visitSchema(value, `${path}.properties.${key}`, visitor);
    }
  }

  if (Array.isArray(node.items)) {
    node.items.forEach((value, index) => {
      visitSchema(value, `${path}.items[${index}]`, visitor);
    });
  } else {
    visitSchema(node.items, `${path}.items`, visitor);
  }
};

describe('shared/aiTripItinerarySchema', () => {
  it('wraps the itinerary schema in a strict structured-output descriptor', () => {
    expect(TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA).toEqual({
      name: TRIP_ITINERARY_SCHEMA_NAME,
      schema: TRIP_ITINERARY_JSON_SCHEMA,
      strict: true,
    });
  });

  it('stays inside the OpenAI strict structured-output JSON Schema subset', () => {
    const unsupportedUsages: string[] = [];
    const objectShapeMismatches: string[] = [];

    visitSchema(TRIP_ITINERARY_JSON_SCHEMA, 'root', (schemaNode, path) => {
      for (const key of OPENAI_STRICT_SCHEMA_UNSUPPORTED_KEYS) {
        if (key in schemaNode) {
          unsupportedUsages.push(`${path}.${key}`);
        }
      }

      if (!isRecord(schemaNode.properties)) return;

      const propertyKeys = Object.keys(schemaNode.properties).sort();
      const requiredKeys = Array.isArray(schemaNode.required)
        ? schemaNode.required
          .filter((value): value is string => typeof value === 'string')
          .sort()
        : [];

      if (schemaNode.additionalProperties !== false) {
        objectShapeMismatches.push(`${path}.additionalProperties`);
      }

      if (propertyKeys.join('|') !== requiredKeys.join('|')) {
        objectShapeMismatches.push(`${path}.required`);
      }
    });

    expect(unsupportedUsages).toEqual([]);
    expect(objectShapeMismatches).toEqual([]);
  });
});
