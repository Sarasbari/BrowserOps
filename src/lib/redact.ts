const sensitiveValues = new Set<string>();

export function registerSensitiveValue(value: string) {
  if (value && value.trim().length > 2) {
    sensitiveValues.add(value);
  }
}

export function clearSensitiveValues() {
  sensitiveValues.clear();
}

export function redactText(text: string): string {
  if (!text) return text;
  let redacted = text;
  for (const value of sensitiveValues) {
    // Escape regex characters to avoid invalid regex patterns
    const escaped = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    redacted = redacted.replace(regex, '[REDACTED]');
  }
  return redacted;
}
