/**
 * Release-note shape and the pure helpers that format one.
 *
 * Split out of `releaseNotesService.ts` so a consumer that renders a single
 * release does not import that module's eager `import.meta.glob` over
 * `content/updates/*.md` — 204 files, a 444 KB chunk. The in-app notice on the
 * trip view was paying that to decide whether to show one notice.
 */
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

const ITEM_TYPE_ORDER: Record<ReleaseNoteItem['typeKey'], number> = {
    new: 0,
    improved: 1,
    fixed: 2,
    update: 3,
    internal: 4,
};

export const sortReleaseItemsByType = (items: ReleaseNoteItem[]): ReleaseNoteItem[] => {
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
