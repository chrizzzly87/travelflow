// Placeholder for future database integration.
// Intentionally inactive: enable and implement when DB is ready.

export const DB_ENABLED = false;

export const saveHistoryEntryToDb = async (_payload: unknown) => {
    if (!DB_ENABLED) return;
    // TODO: Implement persistence via SQLite or remote DB.
};
