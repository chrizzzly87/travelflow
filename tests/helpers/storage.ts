export const setLocalStorageJson = (key: string, value: unknown): void => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const getLocalStorageJson = <T>(key: string): T | null => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
};
