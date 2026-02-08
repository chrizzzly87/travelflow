export type ReleaseStatus = 'published' | 'draft';

export interface ReleaseNoteItem {
    visibleOnWebsite: boolean;
    typeLabel: string;
    typeKey: 'new' | 'improved' | 'fixed' | 'internal' | 'update';
    text: string;
}

export interface ReleaseNoteItemGroup {
    typeKey: ReleaseNoteItem['typeKey'];
    typeLabel: string;
    items: ReleaseNoteItem[];
}

export interface ReleaseNote {
    id: string;
    version: string;
    title: string;
    date: string;
    summary: string;
    status: ReleaseStatus;
    publishedAt: string;
    notifyInApp: boolean;
    inAppHours: number;
    items: ReleaseNoteItem[];
    sourcePath: string;
}

const UPDATE_FILES = import.meta.glob('../content/updates/*.md', {
    eager: true,
    import: 'default',
    query: '?raw',
}) as Record<string, string>;

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const RELEASE_ITEM_REGEX = /^\s*-\s+\[(x|X| )\]\s+\[([^\]]+)\]\s+(.+)$/;
const ITEM_TYPE_ORDER: Record<ReleaseNoteItem['typeKey'], number> = {
    new: 0,
    improved: 1,
    fixed: 2,
    update: 3,
    internal: 4,
};

const stripQuotes = (value: string) => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const parseFrontmatter = (raw: string) => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const match = normalized.match(FRONTMATTER_REGEX);

    if (!match) {
        return { meta: {}, body: normalized };
    }

    const metaLines = match[1].split('\n');
    const meta: Record<string, string> = {};

    for (const line of metaLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf(':');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim().toLowerCase();
        const value = stripQuotes(trimmed.slice(separator + 1));
        meta[key] = value;
    }

    return { meta, body: match[2] };
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
    return fallback;
};

const parseNumber = (value: string | undefined, fallback: number) => {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveTypeKey = (typeLabel: string): ReleaseNoteItem['typeKey'] => {
    const normalized = typeLabel.trim().toLowerCase();
    if (normalized.includes('new')) return 'new';
    if (normalized.includes('improv') || normalized.includes('enhance')) return 'improved';
    if (normalized.includes('fix')) return 'fixed';
    if (normalized.includes('internal') || normalized.includes('infra') || normalized.includes('chore')) return 'internal';
    return 'update';
};

const sortReleaseItemsByType = (items: ReleaseNoteItem[]): ReleaseNoteItem[] => {
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const aOrder = ITEM_TYPE_ORDER[a.item.typeKey] ?? 99;
            const bOrder = ITEM_TYPE_ORDER[b.item.typeKey] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.index - b.index;
        })
        .map(({ item }) => item);
};

const parseReleaseItems = (body: string): ReleaseNoteItem[] => {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const items: ReleaseNoteItem[] = [];

    for (const line of lines) {
        const match = line.match(RELEASE_ITEM_REGEX);
        if (!match) continue;

        items.push({
            visibleOnWebsite: match[1].toLowerCase() === 'x',
            typeLabel: match[2].trim(),
            typeKey: resolveTypeKey(match[2]),
            text: match[3].trim(),
        });
    }

    return sortReleaseItemsByType(items);
};

const toReleaseId = (sourcePath: string, date: string, explicitId?: string) => {
    if (explicitId && explicitId.trim().length > 0) return explicitId.trim();

    const fileName = sourcePath.split('/').pop() || sourcePath;
    const slug = fileName.replace(/\.md$/i, '');
    return `${date}-${slug}`;
};

const parseReleaseFile = (sourcePath: string, raw: string): ReleaseNote | null => {
    const { meta, body } = parseFrontmatter(raw);
    const date = meta.date || new Date(0).toISOString().slice(0, 10);
    const version = meta.version || 'v0.0.0';
    const title = meta.title || 'Untitled release';
    const summary = meta.summary || '';

    const statusValue = (meta.status || 'published').trim().toLowerCase();
    const status: ReleaseStatus = statusValue === 'draft' ? 'draft' : 'published';

    const publishedAt = meta.published_at || `${date}T00:00:00Z`;
    const inAppHours = parseNumber(meta.in_app_hours, 24);

    const parsedPublishedAt = Date.parse(publishedAt);
    if (!Number.isFinite(parsedPublishedAt)) {
        console.warn(`[release-notes] Invalid published_at in ${sourcePath}: ${publishedAt}`);
        return null;
    }

    return {
        id: toReleaseId(sourcePath, date, meta.id),
        version,
        title,
        date,
        summary,
        status,
        publishedAt,
        notifyInApp: parseBoolean(meta.notify_in_app, true),
        inAppHours,
        items: parseReleaseItems(body),
        sourcePath,
    };
};

const allReleaseNotes: ReleaseNote[] = Object.entries(UPDATE_FILES)
    .map(([sourcePath, raw]) => parseReleaseFile(sourcePath, raw))
    .filter((entry): entry is ReleaseNote => !!entry)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

export const getAllReleaseNotes = (): ReleaseNote[] => allReleaseNotes;

export const getPublishedReleaseNotes = (): ReleaseNote[] => {
    return allReleaseNotes.filter((note) => note.status === 'published');
};

export const getWebsiteVisibleItems = (note: ReleaseNote): ReleaseNoteItem[] => {
    return sortReleaseItemsByType(note.items.filter((item) => item.visibleOnWebsite));
};

export const groupReleaseItemsByType = (items: ReleaseNoteItem[]): ReleaseNoteItemGroup[] => {
    const grouped: ReleaseNoteItemGroup[] = [];
    const groupIndexByKey = new Map<string, number>();

    for (const item of items) {
        const key = `${item.typeKey}:${item.typeLabel}`;
        const existingIndex = groupIndexByKey.get(key);

        if (existingIndex === undefined) {
            groupIndexByKey.set(key, grouped.length);
            grouped.push({
                typeKey: item.typeKey,
                typeLabel: item.typeLabel,
                items: [item],
            });
            continue;
        }

        grouped[existingIndex].items.push(item);
    }

    return grouped;
};

export const isReleaseInsideAnnouncementWindow = (note: ReleaseNote, now = Date.now()): boolean => {
    const publishedAtMs = Date.parse(note.publishedAt);
    if (!Number.isFinite(publishedAtMs)) return false;
    if (publishedAtMs > now) return false;

    const hours = Number.isFinite(note.inAppHours) ? note.inAppHours : 24;
    return now - publishedAtMs <= hours * 60 * 60 * 1000;
};

export const getLatestInAppRelease = (now = Date.now()): ReleaseNote | null => {
    const latestNotifiableRelease = getPublishedReleaseNotes().find((note) => note.notifyInApp);
    if (!latestNotifiableRelease) return null;
    if (!isReleaseInsideAnnouncementWindow(latestNotifiableRelease, now)) return null;
    return latestNotifiableRelease;
};
