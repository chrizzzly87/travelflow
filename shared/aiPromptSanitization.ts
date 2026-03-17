import type {
  AiRuntimeSecurityInput,
  AiRuntimeSecurityInputField,
} from "./aiRuntimeSecurity";

export interface AiPromptSanitizationFieldResult {
  name: string;
  originalValue: string;
  sanitizedValue: string;
  changed: boolean;
  removedRuleIds: string[];
}

export interface AiPromptSanitizationResult {
  input: AiRuntimeSecurityInput | null;
  applied: boolean;
  changedFields: string[];
  removedRuleIds: string[];
  fields: AiPromptSanitizationFieldResult[];
}

interface SanitizationRule {
  id: string;
  regex: RegExp;
}

const CLAUSE_SAFE_FIELD_NAMES = new Set([
  "trip_request",
  "notes",
  "destination",
  "destinations",
  "seasonal_events",
]);

const TAG_ONLY_FIELD_NAMES = new Set(["specific_cities"]);

const TAG_BLOCK_RULES: SanitizationRule[] = [
  {
    id: "tagged_payload_block",
    regex:
      /<\s*(?:system|assistant|developer|instructions?|prompt|tool)[^>]*>[\s\S]*?<\s*\/\s*(?:system|assistant|developer|instructions?|prompt|tool)\s*>/gi,
  },
  {
    id: "role_marker_line",
    regex: /(?:^|[\n\r])\s*(?:system|assistant|developer)\s*:[^\n\r]*/gi,
  },
];

const CLAUSE_RULES: SanitizationRule[] = [
  {
    id: "ignore_previous_instructions",
    regex:
      /(?:^|[\s,;:.!?-])ignore(?: all| any| the)? (?:previous|prior|above|system|developer)? instructions?(?:[^.!?\n]*)/gi,
  },
  {
    id: "override_policy",
    regex:
      /(?:^|[\s,;:.!?-])(?:override|bypass|disable)(?:[^.!?\n]{0,80})(?:policy|guard(?:rail)?|safety|instruction|system)(?:[^.!?\n]*)/gi,
  },
  {
    id: "prompt_exfiltration_request",
    regex:
      /(?:^|[\s,;:.!?-])(?:reveal|show|print|dump|quote|leak|expose|return)(?:[^.!?\n]{0,120})(?:system|developer|hidden|internal)(?:[^.!?\n]{0,80})(?:prompt|instruction|message|schema)(?:[^.!?\n]*)/gi,
  },
  {
    id: "secret_exfiltration_request",
    regex:
      /(?:^|[\s,;:.!?-])(?:reveal|show|print|dump|return|include|output)(?:[^.!?\n]{0,140})(?:api[_ -]?key|secret|token|password|service[_ -]?role|env(?:ironment)?(?: variables?)?)(?:[^.!?\n]*)/gi,
  },
  {
    id: "schema_bypass_request",
    regex:
      /(?:^|[\s,;:.!?-])(?:(?:plain text|markdown|free text)(?:[^.!?\n]{0,80})(?:instead of|over|rather than)(?:[^.!?\n]{0,40})(?:json|schema)|(?:do not|don't|no need to)(?:[^.!?\n]{0,40})(?:use|return)(?:[^.!?\n]{0,40})json|ignore(?:[^.!?\n]{0,40})(?:schema|json contract))(?:[^.!?\n]*)/gi,
  },
];

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const cleanupSanitizedValue = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?]){2,}/g, "$1")
    .replace(/^[,.;:!?-]+\s*/g, "")
    .replace(/\s*[,.;:!?-]+$/g, "")
    .trim();

const sanitizePromptFieldValue = (
  name: string,
  value: string,
): AiPromptSanitizationFieldResult => {
  const originalValue = typeof value === "string" ? value.trim() : "";
  if (!originalValue) {
    return {
      name,
      originalValue,
      sanitizedValue: "",
      changed: false,
      removedRuleIds: [],
    };
  }

  let sanitizedValue = originalValue;
  const removedRuleIds: string[] = [];

  for (const rule of TAG_BLOCK_RULES) {
    const nextValue = sanitizedValue.replace(rule.regex, " ");
    if (nextValue !== sanitizedValue) {
      sanitizedValue = nextValue;
      removedRuleIds.push(rule.id);
    }
  }

  if (CLAUSE_SAFE_FIELD_NAMES.has(name)) {
    for (const rule of CLAUSE_RULES) {
      const nextValue = sanitizedValue.replace(rule.regex, " ");
      if (nextValue !== sanitizedValue) {
        sanitizedValue = nextValue;
        removedRuleIds.push(rule.id);
      }
    }
  } else if (TAG_ONLY_FIELD_NAMES.has(name)) {
    sanitizedValue = sanitizedValue
      .replace(/\b(?:system|assistant|developer)\s*:[^,;\n\r|]*/gi, " ")
      .replace(
        /\b(?:ignore|reveal|show|print|dump|return)\b[^,;\n\r|]{0,80}/gi,
        " ",
      );
  }

  const cleanedValue = cleanupSanitizedValue(sanitizedValue);
  return {
    name,
    originalValue,
    sanitizedValue: cleanedValue,
    changed: cleanedValue !== originalValue,
    removedRuleIds,
  };
};

const sanitizeUserFields = (
  userFields: AiRuntimeSecurityInputField[],
): AiPromptSanitizationFieldResult[] =>
  userFields
    .map((field) => sanitizePromptFieldValue(field.name, field.value))
    .filter((field) => field.originalValue.length > 0);

export const sanitizeAiRuntimeSecurityInput = (
  input: AiRuntimeSecurityInput | null | undefined,
): AiPromptSanitizationResult => {
  if (!input) {
    return {
      input: null,
      applied: false,
      changedFields: [],
      removedRuleIds: [],
      fields: [],
    };
  }

  const fields = sanitizeUserFields(input.userFields || []);
  const sanitizedUserFields = fields
    .filter((field) => field.sanitizedValue.length > 0)
    .map((field) => ({
      name: field.name,
      value: field.sanitizedValue,
    }));

  const changedFields = fields
    .filter((field) => field.changed)
    .map((field) => field.name);
  const removedRuleIds = Array.from(
    new Set(fields.flatMap((field) => field.removedRuleIds)),
  );

  return {
    input:
      sanitizedUserFields.length > 0
        ? {
            ...input,
            userFields: sanitizedUserFields,
          }
        : null,
    applied: changedFields.length > 0,
    changedFields,
    removedRuleIds,
    fields,
  };
};

export const sanitizePromptTextValue = (name: string, value: string): string =>
  sanitizePromptFieldValue(name, value).sanitizedValue;

export const sanitizePromptListValues = (
  name: string,
  values: string[],
): string[] =>
  values
    .map((value) => sanitizePromptFieldValue(name, value).sanitizedValue)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
