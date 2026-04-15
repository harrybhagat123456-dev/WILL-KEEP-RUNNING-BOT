let currentTargetUrl: string = process.env.TARGET_URL || "";

export function getTargetUrl(): string {
  return currentTargetUrl;
}

export function setTargetUrl(url: string): void {
  currentTargetUrl = url;
}
