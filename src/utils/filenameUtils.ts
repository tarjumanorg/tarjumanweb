export function sanitizeFilename(filename: string): string {
    // 1. Replace known problematic characters (add more as needed)
    let sanitized = filename.replace(/[\s<>:"/\\|?*]+/g, '_');
    // 2. Remove leading/trailing underscores/dots
    sanitized = sanitized.replace(/^[_.]+|[_.]+$/g, '');
    // 3. Limit length (optional)
    const maxLength = 100;
    if (sanitized.length > maxLength) {
      const extDotIndex = sanitized.lastIndexOf('.');
      if (extDotIndex > 0) {
        const name = sanitized.substring(0, extDotIndex);
        const ext = sanitized.substring(extDotIndex);
        sanitized = name.substring(0, maxLength - ext.length) + ext;
      } else {
        sanitized = sanitized.substring(0, maxLength);
      }
    }
    // 4. Handle empty filenames after sanitization
    if (!sanitized) {
      return 'untitled';
    }
    return sanitized;
  }