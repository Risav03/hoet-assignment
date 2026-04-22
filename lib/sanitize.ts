/**
 * Simple HTML sanitizer to strip dangerous tags and attributes.
 * For production, use a proper library like DOMPurify (browser) or sanitize-html (server).
 */


const DANGEROUS_ATTRS = /\bon\w+\s*=|javascript:|data:|vbscript:/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>/gi, "")
    .replace(/<object[\s\S]*?>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(DANGEROUS_ATTRS, "");
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
