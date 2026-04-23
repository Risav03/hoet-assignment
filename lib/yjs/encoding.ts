/**
 * Encode a Uint8Array to a base64 string for JSON transport.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to a Uint8Array.
 */
export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Return true if the string is a valid base64-encoded value.
 * Used for server-side input validation.
 */
export function isValidBase64(value: string): boolean {
  if (typeof value !== "string") return false;
  try {
    return btoa(atob(value)) === value;
  } catch {
    return false;
  }
}
