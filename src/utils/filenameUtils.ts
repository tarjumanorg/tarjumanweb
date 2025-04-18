// src/utils/filenameUtils.ts

/**
 * Sanitizes a filename by replacing potentially problematic characters with underscores,
 * trimming leading/trailing underscores/dots, and enforcing a max length.
 */
export function sanitizeFilename(filename: string): string {
  // Replace whitespace and unsafe characters with underscores
  let sanitized = filename.replace(/[\s<>:"/\\|?*]+/g, '_');

  // Remove leading/trailing underscores or dots
  sanitized = sanitized.replace(/^[_.]+|[_.]+$/g, '');

  // Enforce a maximum length, preserving extension if possible
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    const extDotIndex = sanitized.lastIndexOf('.');
    if (extDotIndex > 0 && extDotIndex > sanitized.length - 10) { // Check if dot is likely an extension
      const name = sanitized.substring(0, extDotIndex);
      const ext = sanitized.substring(extDotIndex);
      // Ensure name part doesn't become empty
      const maxNameLength = Math.max(0, maxLength - ext.length);
      sanitized = name.substring(0, maxNameLength) + ext;
    } else {
      // No extension or extension is too long / dot too early, just truncate
      sanitized = sanitized.substring(0, maxLength);
    }
  }

  // Handle cases where sanitization results in an empty string
  if (!sanitized) {
    return 'untitled';
  }
  return sanitized;
}

/**
 * Extracts the filename part from a storage path (e.g., 'user/123/file.txt' -> 'file.txt').
 * Handles potential decoding issues. Returns null if path is empty.
 */
export function extractFilename(path: string | null | undefined): string | null {
    if (!path) return null;
    try {
        // Decode URI component first to handle encoded characters like %20
        const decodedPath = decodeURIComponent(path);
        // Get the last part after the last slash
        return decodedPath.split('/').pop() || decodedPath;
    } catch (e) {
        console.warn(`Failed to decode or extract filename from path: ${path}`, e);
        // Fallback: return the original path segment after the last slash if decoding fails
        return path.split('/').pop() || path;
    }
}

/**
 * Generates a short random alphanumeric string suffix.
 * @param length The desired length of the suffix (default: 6).
 */
export const generateRandomSuffix = (length = 6): string => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}