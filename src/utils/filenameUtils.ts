export function sanitizeFilename(filename: string): string {

  let sanitized = filename.replace(/[\s<>:"/\\|?*]+/g, '_');

  sanitized = sanitized.replace(/^[_.]+|[_.]+$/g, '');

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

  if (!sanitized) {
    return 'untitled';
  }
  return sanitized;
}