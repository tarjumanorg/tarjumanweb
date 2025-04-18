export function sanitizeFilename(filename: string): string {

  let sanitized = filename.replace(/[\s<>:"/\\|?*]+/g, '_');

  sanitized = sanitized.replace(/^[_.]+|[_.]+$/g, '');

  const maxLength = 100;
  if (sanitized.length > maxLength) {
    const extDotIndex = sanitized.lastIndexOf('.');
    if (extDotIndex > 0 && extDotIndex > sanitized.length - 10) { 
      const name = sanitized.substring(0, extDotIndex);
      const ext = sanitized.substring(extDotIndex);

      const maxNameLength = Math.max(0, maxLength - ext.length);
      sanitized = name.substring(0, maxNameLength) + ext;
    } else {

      sanitized = sanitized.substring(0, maxLength);
    }
  }

  if (!sanitized) {
    return 'untitled';
  }
  return sanitized;
}

export function extractFilename(path: string | null | undefined): string | null {
    if (!path) return null;
    try {

        const decodedPath = decodeURIComponent(path);

        return decodedPath.split('/').pop() || decodedPath;
    } catch (e) {
        console.warn(`Failed to decode or extract filename from path: ${path}`, e);

        return path.split('/').pop() || path;
    }
}

export const generateRandomSuffix = (length = 6): string => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}