export const APP_NAME = 'TravelFlow';

export const APP_DEFAULT_DESCRIPTION = `Plan and share travel routes with timeline and map previews in ${APP_NAME}.`;

export const applyAppNameTemplate = (value: string): string => {
    return value.replace(/\{\{\s*appName\s*\}\}/g, APP_NAME);
};
