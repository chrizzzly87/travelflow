const parseNumericToken = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseColonTimeToHours = (value: string): number | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes >= 60) return null;
  const total = hours + (minutes / 60);
  return total > 0 ? total : null;
};

const parseDurationUnitsToHours = (value: string): number | null => {
  const normalized = value
    .toLocaleLowerCase()
    .trim()
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');

  if (!normalized) return null;

  const directNumeric = parseNumericToken(normalized);
  if (directNumeric !== null) return directNumeric;

  const colonHours = parseColonTimeToHours(normalized);
  if (colonHours !== null) return colonHours;

  const tokenRegex = /(\d+(?:\.\d+)?)\s*(days?|day|d|hours?|hour|hrs?|hr|h|minutes?|minute|mins?|min|m)\b/g;
  let totalHours = 0;
  let matched = false;

  for (const token of normalized.matchAll(tokenRegex)) {
    const amount = Number(token[1]);
    const unit = token[2];
    if (!Number.isFinite(amount) || amount <= 0) continue;
    matched = true;

    if (unit.startsWith('d')) {
      totalHours += amount * 24;
      continue;
    }
    if (unit.startsWith('h')) {
      totalHours += amount;
      continue;
    }
    totalHours += amount / 60;
  }

  if (!matched || totalHours <= 0) return null;
  return totalHours;
};

export const parseFlexibleDurationHours = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  return parseDurationUnitsToHours(value);
};

export const parseFlexibleDurationDays = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const hours = parseDurationUnitsToHours(value);
  if (hours === null) return null;
  return hours / 24;
};

export const buildDurationPromptGuidance = (): string => `
      Duration contract (strict):
      - travelSegments.duration MUST be a number in hours (no unit string).
      - activities.duration MUST be a number in days (can be fractional for partial days).
      - Valid examples:
        {"travelSegments":[{"duration":2.5}]}
        {"activities":[{"duration":0.5}]}
      - Invalid examples:
        {"travelSegments":[{"duration":"2 hours"}]}
        {"activities":[{"duration":"45 minutes"}]}
    `;
