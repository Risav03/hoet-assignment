/**
 * Simple content patch utilities for document diffing.
 * Uses a patch format: { content: string } for full content replacement.
 * For production, integrate a proper OT/CRDT or JSON Patch library.
 */

export interface ContentPatch {
  content: string;
  baseLength?: number;
}

export function createPatch(oldContent: string, newContent: string): ContentPatch {
  return { content: newContent, baseLength: oldContent.length };
}

export function applyPatch(base: string, patch: ContentPatch): string {
  return patch.content;
}

export function parsePatch(raw: string): ContentPatch {
  try {
    return JSON.parse(raw) as ContentPatch;
  } catch {
    return { content: raw };
  }
}

export function computeChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
