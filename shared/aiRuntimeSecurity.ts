import { sanitizeAiRuntimeSecurityInput } from "./aiPromptSanitization.ts";

export const AI_RUNTIME_SECURITY_ATTACK_CATEGORIES = [
  "instruction_override",
  "prompt_exfiltration",
  "secret_exfiltration",
  "schema_bypass",
  "constraint_override",
  "suspicious_destination_payload",
] as const;

export type AiRuntimeSecurityAttackCategory =
  (typeof AI_RUNTIME_SECURITY_ATTACK_CATEGORIES)[number];

export const AI_RUNTIME_SECURITY_GUARD_DECISIONS = [
  "allow",
  "warn",
  "block",
] as const;

export type AiRuntimeSecurityGuardDecision =
  (typeof AI_RUNTIME_SECURITY_GUARD_DECISIONS)[number];

export const AI_RUNTIME_SECURITY_STAGES = [
  "input_preflight",
  "output_postflight",
] as const;

export type AiRuntimeSecurityStage =
  (typeof AI_RUNTIME_SECURITY_STAGES)[number];

export interface AiRuntimeSecurityInputField {
  name: string;
  value: string;
}

export interface AiRuntimeSecurityInput {
  flow?: string | null;
  routeLock?: boolean;
  destinationOrder?: string[];
  requiredCities?: string[];
  userFields: AiRuntimeSecurityInputField[];
}

export interface AiRuntimeSecuritySignal {
  stage: AiRuntimeSecurityStage;
  guardDecision: AiRuntimeSecurityGuardDecision;
  riskScore: number;
  blocked: boolean;
  suspicious: boolean;
  attackCategories: AiRuntimeSecurityAttackCategory[];
  matchedRules: string[];
  flaggedFields: string[];
  promptFingerprintSha256: string | null;
  redactedExcerpt: string | null;
}

export interface AiRuntimeSecuritySanitization {
  applied: boolean;
  changedFields: string[];
  removedRuleIds: string[];
}

export interface AiRuntimeSecurityMetadata extends AiRuntimeSecuritySignal {
  tripId?: string | null;
  attemptId?: string | null;
  signals?: AiRuntimeSecuritySignal[];
  sanitization?: AiRuntimeSecuritySanitization | null;
}

export interface AiRuntimeInputSecurityEvaluation {
  rawSignal: AiRuntimeSecuritySignal;
  effectiveSignal: AiRuntimeSecuritySignal;
  sanitization: AiRuntimeSecuritySanitization | null;
}

interface DetectionRule {
  id: string;
  category: AiRuntimeSecurityAttackCategory;
  weight: number;
  regex: RegExp;
  forceBlock?: boolean;
}

interface AiRuntimeSecurityOutputOptions {
  rawOutputText?: string | null;
  parsedData?: Record<string, unknown> | null;
  validation?: { schemaValid: boolean; errors: string[] } | null;
  input?: AiRuntimeSecurityInput | null;
  forceSchemaBypass?: boolean;
}

const HIGH_CONFIDENCE_BLOCK_CATEGORIES =
  new Set<AiRuntimeSecurityAttackCategory>([
    "prompt_exfiltration",
    "secret_exfiltration",
  ]);

const INPUT_RULES: DetectionRule[] = [
  {
    id: "ignore_previous_instructions",
    category: "instruction_override",
    weight: 45,
    regex:
      /ignore(?: all| any| the)? (?:previous|prior|above|system|developer)? instructions?/i,
  },
  {
    id: "override_policy",
    category: "instruction_override",
    weight: 45,
    regex:
      /(?:override|bypass|disable).{0,20}(?:policy|guard(?:rail)?|safety|instruction|system)/i,
  },
  {
    id: "prompt_exfiltration_request",
    category: "prompt_exfiltration",
    weight: 80,
    forceBlock: true,
    regex:
      /(?:reveal|show|print|dump|quote|leak|expose|return).{0,40}(?:system|developer|hidden|internal).{0,20}(?:prompt|instruction|message|schema)/i,
  },
  {
    id: "secret_exfiltration_request",
    category: "secret_exfiltration",
    weight: 90,
    forceBlock: true,
    regex:
      /(?:reveal|show|print|dump|return|include|output).{0,50}(?:api[_ -]?key|secret|token|password|service[_ -]?role|env(?:ironment)?(?: variables?)?)/i,
  },
  {
    id: "schema_bypass_request",
    category: "schema_bypass",
    weight: 60,
    forceBlock: true,
    regex:
      /(?:plain text|markdown|free text).{0,30}(?:instead of|over|rather than).{0,20}(?:json|schema)|(?:do not|don't|no need to).{0,20}(?:use|return).{0,20}json|ignore.{0,20}(?:schema|json contract)/i,
  },
  {
    id: "constraint_override_request",
    category: "constraint_override",
    weight: 55,
    regex:
      /(?:ignore|change|reorder|drop|add).{0,40}(?:required cities|requested cities|route lock|locked order|city order|constraints?)/i,
  },
  {
    id: "role_marker_payload",
    category: "suspicious_destination_payload",
    weight: 25,
    regex: /(?:^|[\n\r\s])(system|assistant|developer)\s*:/i,
  },
  {
    id: "tagged_payload",
    category: "suspicious_destination_payload",
    weight: 25,
    regex:
      /<\s*(?:system|assistant|developer|instructions?|prompt|tool)[^>]*>/i,
  },
];

const OUTPUT_RULES: DetectionRule[] = [
  {
    id: "output_prompt_leak",
    category: "prompt_exfiltration",
    weight: 90,
    forceBlock: true,
    regex:
      /(?:system prompt|developer message|hidden instructions|internal prompt|prompt template|json schema|required fields|additionalProperties)/i,
  },
  {
    id: "output_secret_leak",
    category: "secret_exfiltration",
    weight: 100,
    forceBlock: true,
    regex:
      /\b(?:sk-[a-zA-Z0-9]{10,}|AIza[0-9A-Za-z\-_]{20,}|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b/,
  },
  {
    id: "output_schema_bypass",
    category: "schema_bypass",
    weight: 95,
    forceBlock: true,
    regex:
      /(?:ignore previous instructions|plain text instead of json|not valid json|no json object)/i,
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeSpecificCities = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 20);
};

const normalizeAiRuntimeSecurityInputField = (
  value: unknown,
): AiRuntimeSecurityInputField | null => {
  if (!isRecord(value)) return null;
  const name = asTrimmedString(value.name);
  const fieldValue = asTrimmedString(value.value);
  if (!name || !fieldValue) return null;
  return {
    name,
    value: fieldValue,
  };
};

const capRiskScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const redactSensitiveText = (value: string): string =>
  value
    .replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "[redacted-openai-key]")
    .replace(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "[redacted-google-key]")
    .replace(
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b/g,
      "[redacted-secret-name]",
    );

const clipText = (value: string, max = 220): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const normalizeCityName = (value: string): string =>
  normalizeWhitespace(value).toLocaleLowerCase();

const extractOutputCityNames = (
  parsedData: Record<string, unknown> | null | undefined,
): string[] => {
  if (!parsedData || !Array.isArray(parsedData.cities)) return [];
  return parsedData.cities
    .map((city) => (isRecord(city) ? asTrimmedString(city.name) : null))
    .filter((city): city is string => Boolean(city))
    .map(normalizeCityName);
};

const routeOrderSatisfied = (
  outputCities: string[],
  destinationOrder: string[],
): boolean => {
  if (destinationOrder.length === 0) return true;
  let currentIndex = 0;
  for (const requiredCity of destinationOrder) {
    const requiredName = normalizeCityName(requiredCity);
    const foundIndex = outputCities.findIndex(
      (city, index) => index >= currentIndex && city.includes(requiredName),
    );
    if (foundIndex < 0) return false;
    currentIndex = foundIndex + 1;
  }
  return true;
};

const buildPromptFingerprintSource = (
  input: AiRuntimeSecurityInput | null | undefined,
): string => {
  if (!input) return "";
  const parts = [
    input.flow || "",
    String(input.routeLock === true),
    ...(input.destinationOrder || []),
    ...(input.requiredCities || []),
    ...input.userFields.map((field) => `${field.name}:${field.value}`),
  ];
  return parts.filter(Boolean).join("\n");
};

const toHex = (buffer: ArrayBuffer): string => {
  const view = new Uint8Array(buffer);
  return Array.from(view)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const sha256Hex = async (value: string): Promise<string | null> => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
};

const evaluateRules = (
  text: string,
  rules: DetectionRule[],
): {
  categories: Set<AiRuntimeSecurityAttackCategory>;
  matchedRules: Set<string>;
  riskScore: number;
  forceBlock: boolean;
  excerpt: string | null;
} => {
  const categories = new Set<AiRuntimeSecurityAttackCategory>();
  const matchedRules = new Set<string>();
  let riskScore = 0;
  let forceBlock = false;
  let excerpt: string | null = null;

  for (const rule of rules) {
    const match = text.match(rule.regex);
    if (!match) continue;
    categories.add(rule.category);
    matchedRules.add(rule.id);
    riskScore += rule.weight;
    if (rule.forceBlock) forceBlock = true;
    if (!excerpt) {
      excerpt = clipText(redactSensitiveText(normalizeWhitespace(match[0])));
    }
  }

  return {
    categories,
    matchedRules,
    riskScore: capRiskScore(riskScore),
    forceBlock,
    excerpt,
  };
};

const buildSignal = async (params: {
  stage: AiRuntimeSecurityStage;
  input?: AiRuntimeSecurityInput | null;
  categories: Set<AiRuntimeSecurityAttackCategory>;
  matchedRules: Set<string>;
  flaggedFields?: Set<string>;
  riskScore: number;
  forceBlock: boolean;
  excerpt?: string | null;
}): Promise<AiRuntimeSecuritySignal> => {
  const attackCategories = [...params.categories];
  const matchedRules = [...params.matchedRules];
  const flaggedFields = [...(params.flaggedFields || new Set<string>())];
  const suspicious = attackCategories.length > 0 || params.riskScore > 0;
  const blocked =
    params.forceBlock ||
    attackCategories.some((category) =>
      HIGH_CONFIDENCE_BLOCK_CATEGORIES.has(category),
    ) ||
    params.riskScore >= 85;
  const guardDecision: AiRuntimeSecurityGuardDecision = blocked
    ? "block"
    : suspicious
      ? "warn"
      : "allow";

  return {
    stage: params.stage,
    guardDecision,
    riskScore: capRiskScore(params.riskScore),
    blocked,
    suspicious,
    attackCategories,
    matchedRules,
    flaggedFields,
    promptFingerprintSha256: await sha256Hex(
      buildPromptFingerprintSource(params.input || null),
    ),
    redactedExcerpt: params.excerpt || null,
  };
};

export const normalizeAiRuntimeSecurityInput = (
  value: unknown,
): AiRuntimeSecurityInput | null => {
  if (!isRecord(value)) return null;
  const userFields = Array.isArray(value.userFields)
    ? value.userFields
        .map((field) => normalizeAiRuntimeSecurityInputField(field))
        .filter((field): field is AiRuntimeSecurityInputField => Boolean(field))
    : [];

  if (userFields.length === 0) return null;

  return {
    flow: asTrimmedString(value.flow),
    routeLock: value.routeLock === true,
    destinationOrder: normalizeStringList(value.destinationOrder),
    requiredCities: normalizeStringList(value.requiredCities),
    userFields,
  };
};

export const buildAiRuntimeSecurityInputFromTripInputSnapshot = (
  value: unknown,
): AiRuntimeSecurityInput | null => {
  if (!isRecord(value)) return null;
  const flow = asTrimmedString(value.flow);
  const payload = isRecord(value.payload) ? value.payload : null;
  if (!flow || !payload) return null;

  const fields: AiRuntimeSecurityInputField[] = [];
  let routeLock = false;
  let destinationOrder: string[] = [];
  let requiredCities: string[] = [];

  if (flow === "classic") {
    const tripRequest = asTrimmedString(payload.destinationPrompt);
    if (tripRequest) fields.push({ name: "trip_request", value: tripRequest });
    const options = isRecord(payload.options) ? payload.options : null;
    if (options) {
      const notes = asTrimmedString(options.notes);
      const specificCities = asTrimmedString(options.specificCities);
      if (notes) fields.push({ name: "notes", value: notes });
      if (specificCities)
        fields.push({ name: "specific_cities", value: specificCities });
      routeLock = options.routeLock === true;
      destinationOrder = normalizeStringList(options.destinationOrder);
      requiredCities = normalizeSpecificCities(options.specificCities);
    }
  }

  if (flow === "wizard") {
    const options = isRecord(payload.options) ? payload.options : null;
    if (options) {
      normalizeStringList(options.countries).forEach((country) => {
        fields.push({ name: "destinations", value: country });
      });
      const notes = asTrimmedString(options.notes);
      const specificCities = asTrimmedString(options.specificCities);
      if (notes) fields.push({ name: "notes", value: notes });
      if (specificCities)
        fields.push({ name: "specific_cities", value: specificCities });
      routeLock = options.routeLock === true;
      destinationOrder = normalizeStringList(options.destinationOrder);
      requiredCities = normalizeSpecificCities(options.specificCities);
    }
  }

  if (flow === "surprise") {
    const options = isRecord(payload.options) ? payload.options : null;
    if (options) {
      const country = asTrimmedString(options.country);
      const notes = asTrimmedString(options.notes);
      if (country) fields.push({ name: "destination", value: country });
      if (notes) fields.push({ name: "notes", value: notes });
      normalizeStringList(options.seasonalEvents).forEach((event) => {
        fields.push({ name: "seasonal_events", value: event });
      });
    }
  }

  if (fields.length === 0) return null;

  return {
    flow,
    routeLock,
    destinationOrder,
    requiredCities,
    userFields: fields,
  };
};

export const detectAiRuntimeInputSecurity = async (
  input: AiRuntimeSecurityInput | null | undefined,
): Promise<AiRuntimeSecuritySignal> => {
  const normalizedInput = normalizeAiRuntimeSecurityInput(input);
  if (!normalizedInput) {
    return {
      stage: "input_preflight",
      guardDecision: "allow",
      riskScore: 0,
      blocked: false,
      suspicious: false,
      attackCategories: [],
      matchedRules: [],
      flaggedFields: [],
      promptFingerprintSha256: null,
      redactedExcerpt: null,
    };
  }

  const categories = new Set<AiRuntimeSecurityAttackCategory>();
  const matchedRules = new Set<string>();
  const flaggedFields = new Set<string>();
  let riskScore = 0;
  let forceBlock = false;
  let excerpt: string | null = null;

  normalizedInput.userFields.forEach((field) => {
    const result = evaluateRules(field.value, INPUT_RULES);
    result.categories.forEach((category) => categories.add(category));
    result.matchedRules.forEach((rule) =>
      matchedRules.add(`${field.name}:${rule}`),
    );
    if (result.matchedRules.size > 0) {
      flaggedFields.add(field.name);
    }
    riskScore += result.riskScore;
    if (result.forceBlock) forceBlock = true;
    if (!excerpt && result.excerpt)
      excerpt = `${field.name}: ${result.excerpt}`;
  });

  if (
    normalizedInput.routeLock &&
    normalizedInput.destinationOrder.length > 0
  ) {
    matchedRules.add("route_lock_present");
  }

  return buildSignal({
    stage: "input_preflight",
    input: normalizedInput,
    categories,
    matchedRules,
    flaggedFields,
    riskScore,
    forceBlock,
    excerpt,
  });
};

export const detectAiRuntimeOutputSecurity = async (
  options: AiRuntimeSecurityOutputOptions,
): Promise<AiRuntimeSecuritySignal> => {
  const normalizedInput = normalizeAiRuntimeSecurityInput(options.input);
  const categories = new Set<AiRuntimeSecurityAttackCategory>();
  const matchedRules = new Set<string>();
  const flaggedFields = new Set<string>();
  let riskScore = 0;
  let forceBlock = false;
  let excerpt: string | null = null;

  const rawText =
    typeof options.rawOutputText === "string" ? options.rawOutputText : "";
  const parsedData = isRecord(options.parsedData) ? options.parsedData : null;
  const validation = options.validation || null;
  const outputText = rawText || (parsedData ? JSON.stringify(parsedData) : "");

  if (outputText) {
    const result = evaluateRules(outputText, OUTPUT_RULES);
    result.categories.forEach((category) => categories.add(category));
    result.matchedRules.forEach((rule) => matchedRules.add(rule));
    riskScore += result.riskScore;
    if (result.forceBlock) forceBlock = true;
    if (!excerpt && result.excerpt) excerpt = result.excerpt;
  }

  if (
    options.forceSchemaBypass ||
    (validation && (!validation.schemaValid || validation.errors.length > 0))
  ) {
    categories.add("schema_bypass");
    matchedRules.add("schema_validation_failed");
    riskScore += 95;
    forceBlock = true;
    if (!excerpt && validation?.errors?.[0]) {
      excerpt = clipText(normalizeWhitespace(validation.errors[0]));
    }
  }

  if (parsedData && normalizedInput) {
    const outputCities = extractOutputCityNames(parsedData);
    const missingRequiredCities = normalizedInput.requiredCities
      .map(normalizeCityName)
      .filter(
        (city) => !outputCities.some((outputCity) => outputCity.includes(city)),
      );

    if (missingRequiredCities.length > 0) {
      categories.add("constraint_override");
      matchedRules.add("missing_required_cities");
      riskScore += 90;
      forceBlock = true;
      if (!excerpt) {
        excerpt = `missing required cities: ${missingRequiredCities.join(", ")}`;
      }
    }

    if (
      normalizedInput.routeLock &&
      normalizedInput.destinationOrder.length > 1 &&
      !routeOrderSatisfied(outputCities, normalizedInput.destinationOrder)
    ) {
      categories.add("constraint_override");
      matchedRules.add("route_lock_order_violated");
      riskScore += 90;
      forceBlock = true;
      if (!excerpt) {
        excerpt = `route lock violated: ${normalizedInput.destinationOrder.join(" -> ")}`;
      }
    }
  }

  return buildSignal({
    stage: "output_postflight",
    input: normalizedInput,
    categories,
    matchedRules,
    flaggedFields,
    riskScore,
    forceBlock,
    excerpt,
  });
};

export const evaluateAiRuntimeInputSecurity = async (
  input: AiRuntimeSecurityInput | null | undefined,
): Promise<AiRuntimeInputSecurityEvaluation> => {
  const rawSignal = await detectAiRuntimeInputSecurity(input);
  const sanitizationResult = sanitizeAiRuntimeSecurityInput(
    normalizeAiRuntimeSecurityInput(input),
  );

  if (!sanitizationResult.applied || !sanitizationResult.input) {
    return {
      rawSignal,
      effectiveSignal: rawSignal,
      sanitization: null,
    };
  }

  const sanitizedSignal = await detectAiRuntimeInputSecurity(
    sanitizationResult.input,
  );
  const effectiveSignal: AiRuntimeSecuritySignal =
    rawSignal.blocked && !sanitizedSignal.blocked
      ? {
          ...rawSignal,
          guardDecision: "warn",
          blocked: false,
          suspicious: true,
          matchedRules: [
            ...new Set([...rawSignal.matchedRules, "sanitization_applied"]),
          ],
          flaggedFields: [
            ...new Set([
              ...rawSignal.flaggedFields,
              ...sanitizationResult.changedFields,
            ]),
          ],
        }
      : rawSignal.guardDecision === "warn" &&
          sanitizedSignal.guardDecision === "allow"
        ? {
            ...rawSignal,
            matchedRules: [
              ...new Set([...rawSignal.matchedRules, "sanitization_applied"]),
            ],
            flaggedFields: [
              ...new Set([
                ...rawSignal.flaggedFields,
                ...sanitizationResult.changedFields,
              ]),
            ],
          }
        : rawSignal;

  return {
    rawSignal,
    effectiveSignal,
    sanitization: {
      applied: true,
      changedFields: sanitizationResult.changedFields,
      removedRuleIds: sanitizationResult.removedRuleIds,
    },
  };
};

export const summarizeAiRuntimeSecuritySignals = (
  signals: Array<AiRuntimeSecuritySignal | null | undefined>,
  context?: { tripId?: string | null; attemptId?: string | null },
): AiRuntimeSecurityMetadata => {
  const filtered = signals.filter((signal): signal is AiRuntimeSecuritySignal =>
    Boolean(signal),
  );
  const primary = filtered.slice().sort((left, right) => {
    const decisionScore = (value: AiRuntimeSecurityGuardDecision): number =>
      value === "block" ? 3 : value === "warn" ? 2 : 1;
    return (
      decisionScore(right.guardDecision) - decisionScore(left.guardDecision) ||
      right.riskScore - left.riskScore
    );
  })[0] || {
    stage: "input_preflight" as const,
    guardDecision: "allow" as const,
    riskScore: 0,
    blocked: false,
    suspicious: false,
    attackCategories: [],
    matchedRules: [],
    flaggedFields: [],
    promptFingerprintSha256: null,
    redactedExcerpt: null,
  };

  const attackCategories = [
    ...new Set(filtered.flatMap((signal) => signal.attackCategories)),
  ];
  const matchedRules = [
    ...new Set(filtered.flatMap((signal) => signal.matchedRules)),
  ];
  const flaggedFields = [
    ...new Set(filtered.flatMap((signal) => signal.flaggedFields || [])),
  ];

  return {
    ...primary,
    suspicious: filtered.some((signal) => signal.suspicious),
    blocked: filtered.some((signal) => signal.blocked),
    attackCategories,
    matchedRules,
    flaggedFields,
    riskScore: capRiskScore(
      Math.max(...filtered.map((signal) => signal.riskScore), 0),
    ),
    promptFingerprintSha256:
      filtered.find((signal) => signal.promptFingerprintSha256)
        ?.promptFingerprintSha256 || null,
    redactedExcerpt:
      filtered.find((signal) => signal.redactedExcerpt)?.redactedExcerpt ||
      null,
    tripId: context?.tripId || null,
    attemptId: context?.attemptId || null,
    signals: filtered.length > 0 ? filtered : undefined,
  };
};

export const extractAiRuntimeSecurityMetadata = (
  value: unknown,
): AiRuntimeSecurityMetadata | null => {
  if (!isRecord(value)) return null;
  const attackCategories = Array.isArray(value.attackCategories)
    ? value.attackCategories.filter(
        (entry): entry is AiRuntimeSecurityAttackCategory =>
          typeof entry === "string" &&
          AI_RUNTIME_SECURITY_ATTACK_CATEGORIES.includes(
            entry as AiRuntimeSecurityAttackCategory,
          ),
      )
    : [];
  const matchedRules = Array.isArray(value.matchedRules)
    ? value.matchedRules.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
  const flaggedFields = Array.isArray(value.flaggedFields)
    ? value.flaggedFields.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [
        ...new Set(
          matchedRules
            .map((rule) => {
              const separatorIndex = rule.indexOf(":");
              return separatorIndex > 0
                ? rule.slice(0, separatorIndex).trim()
                : null;
            })
            .filter((entry): entry is string => Boolean(entry)),
        ),
      ];
  const stage =
    typeof value.stage === "string" &&
    AI_RUNTIME_SECURITY_STAGES.includes(value.stage as AiRuntimeSecurityStage)
      ? (value.stage as AiRuntimeSecurityStage)
      : null;
  const guardDecision =
    typeof value.guardDecision === "string" &&
    AI_RUNTIME_SECURITY_GUARD_DECISIONS.includes(
      value.guardDecision as AiRuntimeSecurityGuardDecision,
    )
      ? (value.guardDecision as AiRuntimeSecurityGuardDecision)
      : null;
  if (!stage || !guardDecision) return null;

  return {
    stage,
    guardDecision,
    riskScore: capRiskScore(Number(value.riskScore) || 0),
    blocked: value.blocked === true,
    suspicious:
      value.suspicious === true ||
      attackCategories.length > 0 ||
      guardDecision !== "allow",
    attackCategories,
    matchedRules,
    flaggedFields,
    promptFingerprintSha256: asTrimmedString(value.promptFingerprintSha256),
    redactedExcerpt: asTrimmedString(value.redactedExcerpt),
    tripId: asTrimmedString(value.tripId),
    attemptId: asTrimmedString(value.attemptId),
    sanitization: isRecord(value.sanitization)
      ? {
          applied: value.sanitization.applied === true,
          changedFields: Array.isArray(value.sanitization.changedFields)
            ? value.sanitization.changedFields.filter(
                (entry): entry is string =>
                  typeof entry === "string" && entry.trim().length > 0,
              )
            : [],
          removedRuleIds: Array.isArray(value.sanitization.removedRuleIds)
            ? value.sanitization.removedRuleIds.filter(
                (entry): entry is string =>
                  typeof entry === "string" && entry.trim().length > 0,
              )
            : [],
        }
      : null,
    signals: Array.isArray(value.signals)
      ? value.signals
          .map((signal) => extractAiRuntimeSecurityMetadata(signal))
          .filter((signal): signal is AiRuntimeSecuritySignal =>
            Boolean(signal),
          )
      : undefined,
  };
};
