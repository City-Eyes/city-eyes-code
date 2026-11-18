export function getApiBaseUrl(rawDomain?: string | null): string {
  const domain = (rawDomain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "").trim();
  if (!domain) {
    return "";
  }
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanDomain);
  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${cleanDomain}`;
}
