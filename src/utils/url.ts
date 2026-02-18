const URL_REGEX = /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*))/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) {
    return [];
  }
  return [...new Set(matches)]; // Remove duplicates
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
