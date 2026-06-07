const STORAGE_KEY = "tribe_server_url";

export function getServerUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setServerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

export function clearServerUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}
