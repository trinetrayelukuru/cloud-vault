const path = require('path');

// Common file signatures (magic numbers) as hex strings
const MAGIC_NUMBERS = {
  // Images
  'ffd8ffe0': { ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  'ffd8ffe1': { ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  'ffd8ffe2': { ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  'ffd8ffdb': { ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  'ffd8ffee': { ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  '89504e47': { ext: 'png', mime: 'image/png', category: 'image' },
  '47494638': { ext: 'gif', mime: 'image/gif', category: 'image' },
  '424d':     { ext: 'bmp', mime: 'image/bmp', category: 'image' },
  '52494646': { ext: 'webp', mime: 'image/webp', category: 'image' }, // RIFF prefix (also wav/avi)

  // Documents
  '25504446': { ext: 'pdf', mime: 'application/pdf', category: 'document' },
  'd0cf11e0': { ext: 'doc', mime: 'application/msword', category: 'document' }, // OLE2 (doc, xls, ppt)
  '504b0304': { ext: 'zip', mime: 'application/zip', category: 'archive' }, // PK zip (also docx, xlsx, pptx)

  // Archives
  '52617221': { ext: 'rar', mime: 'application/x-rar-compressed', category: 'archive' },
  '377abcaf': { ext: '7z', mime: 'application/x-7z-compressed', category: 'archive' },
  '1f8b08':   { ext: 'gz', mime: 'application/gzip', category: 'archive' },
  '425a68':   { ext: 'bz2', mime: 'application/x-bzip2', category: 'archive' },

  // Videos / Audio
  '00000018': { ext: 'mp4', mime: 'video/mp4', category: 'video' },
  '00000020': { ext: 'mp4', mime: 'video/mp4', category: 'video' },
  '1a45dfa3': { ext: 'mkv', mime: 'video/x-matroska', category: 'video' }, // WebM / MKV
  '4f676753': { ext: 'ogg', mime: 'audio/ogg', category: 'other' },
  '494433':   { ext: 'mp3', mime: 'audio/mpeg', category: 'other' },

  // Dangerous / Executables (Blocked)
  '4d5a':     { ext: 'exe', mime: 'application/x-msdownload', dangerous: true }, // MZ (Windows PE, EXE, DLL)
  '7f454c46': { ext: 'elf', mime: 'application/x-executable', dangerous: true }, // Linux ELF
  'cafebabe': { ext: 'class', mime: 'application/java-vm', dangerous: true },    // Java Class / Mach-O
  'feedface': { ext: 'macho', mime: 'application/x-mach-binary', dangerous: true },
  'feedfacf': { ext: 'macho64', mime: 'application/x-mach-binary', dangerous: true }
};

// Dangerous file extensions to strictly block
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.vbe', '.js',
  '.jse', '.wsf', '.wsh', '.ps1', '.ps1xml', '.ps2', '.psc1', '.msc',
  '.msi', '.msp', '.com', '.scr', '.hta', '.cpl', '.jar', '.pif', '.reg',
  '.vb', '.vba', '.sys', '.drv', '.apk', '.bin', '.cgi', '.pl', '.py'
]);

// Allowed MIME categories and types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  // Documents
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/gzip', 'application/x-tar', 'application/x-bzip2',
  // Media
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac',
  // JSON / Data
  'application/json', 'application/xml', 'text/xml'
]);

class FileValidator {
  /**
   * Sanitize filename to prevent directory traversal and illegal characters
   */
  static sanitizeFilename(filename) {
    if (!filename) return 'unnamed_file';

    // Remove any path traversal components
    let base = path.basename(filename);

    // Strip null bytes and non-printable ASCII
    base = base.replace(/[\x00-\x1f\x80-\x9f]/g, '');

    // Replace invalid/reserved characters across Windows & Unix: < > : " / \ | ? *
    base = base.replace(/[<>:"/\\|?*]/g, '_');

    // Remove leading/trailing dots and spaces
    base = base.replace(/^[\s.]+|[\s.]+$/g, '');

    // Max length 255
    if (base.length > 255) {
      const ext = path.extname(base);
      const name = path.basename(base, ext).substring(0, 255 - ext.length);
      base = name + ext;
    }

    return base || 'unnamed_file';
  }

  /**
   * Detect file type from buffer using magic numbers and file-type library
   */
  static async detectTypeFromBuffer(buffer, originalFilename = '') {
    if (!buffer || buffer.length === 0) {
      return { mime: 'application/octet-stream', ext: 'bin', category: 'other' };
    }

    // First try file-type dynamic import
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const result = await fileTypeFromBuffer(buffer);
      if (result) {
        return {
          mime: result.mime,
          ext: result.ext,
          category: this.mapMimeToCategory(result.mime)
        };
      }
    } catch (e) {
      // file-type import might fail if not available; fallback to magic numbers
    }

    // Manual Magic Number inspection
    const hexHeader = buffer.slice(0, 8).toString('hex').toLowerCase();

    for (const [magic, info] of Object.entries(MAGIC_NUMBERS)) {
      if (hexHeader.startsWith(magic)) {
        if (info.dangerous) {
          return {
            dangerous: true,
            mime: info.mime,
            ext: info.ext,
            category: 'dangerous'
          };
        }
        return {
          mime: info.mime,
          ext: info.ext,
          category: info.category || this.mapMimeToCategory(info.mime)
        };
      }
    }

    // Check for plain text vs binary
    if (this.isPlainText(buffer)) {
      const ext = path.extname(originalFilename).toLowerCase().replace('.', '');
      return {
        mime: this.getTextMimeType(ext),
        ext: ext || 'txt',
        category: 'document'
      };
    }

    return {
      mime: 'application/octet-stream',
      ext: path.extname(originalFilename).toLowerCase().replace('.', '') || 'bin',
      category: 'other'
    };
  }

  /**
   * Check if a buffer contains UTF-8 / ASCII plain text
   */
  static isPlainText(buffer) {
    const sampleSize = Math.min(buffer.length, 1024);
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      // Check for null bytes or control characters (except tab, newline, CR)
      if (byte === 0 || (byte < 7 && byte !== 0) || (byte > 14 && byte < 32 && byte !== 27)) {
        return false;
      }
    }
    return true;
  }

  static getTextMimeType(ext) {
    const map = {
      'txt': 'text/plain',
      'csv': 'text/csv',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css'
    };
    return map[ext] || 'text/plain';
  }

  /**
   * Map MIME type to Cloud Vault Category
   */
  static mapMimeToCategory(mimeType) {
    if (!mimeType) return 'other';
    const lower = mimeType.toLowerCase();

    if (lower.startsWith('image/')) return 'image';
    if (lower.startsWith('video/')) return 'video';
    if (
      lower.includes('pdf') ||
      lower.includes('document') ||
      lower.includes('text') ||
      lower.includes('word') ||
      lower.includes('excel') ||
      lower.includes('powerpoint') ||
      lower.includes('spreadsheet') ||
      lower.includes('presentation')
    ) {
      return 'document';
    }
    if (
      lower.includes('zip') ||
      lower.includes('rar') ||
      lower.includes('7z') ||
      lower.includes('tar') ||
      lower.includes('gzip') ||
      lower.includes('compressed')
    ) {
      return 'archive';
    }
    return 'other';
  }

  /**
   * Validate uploaded file comprehensively:
   * 1. Extension validation (no .exe, .bat, etc.)
   * 2. Magic number / content inspection
   * 3. Spoofing detection (extension vs real content)
   * 4. Filename sanitization
   */
  static async validateFile(fileBuffer, originalFilename, claimedMimeType) {
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    // 1. Check dangerous file extensions
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        reason: `Executable or dangerous file extension '${ext}' is strictly prohibited.`,
        code: 'PROHIBITED_EXTENSION',
        sanitizedFilename
      };
    }

    // 2. Binary content detection via magic numbers
    const detected = await this.detectTypeFromBuffer(fileBuffer, sanitizedFilename);

    if (detected.dangerous) {
      return {
        valid: false,
        reason: `File content identified as dangerous binary/executable (${detected.mime}). Upload rejected.`,
        code: 'MALICIOUS_CONTENT',
        sanitizedFilename
      };
    }

    // 3. Extension & MIME Spoofing check
    // If user claims image (.png/.jpg) but binary is executable or mismatched
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      if (!detected.mime.startsWith('image/')) {
        return {
          valid: false,
          reason: `File extension '${ext}' does not match real binary signature (${detected.mime}). Possible spoofing attempt.`,
          code: 'SPOOFED_FILE_TYPE',
          sanitizedFilename
        };
      }
    }

    if (ext === '.pdf' && detected.mime !== 'application/pdf' && !detected.mime.includes('pdf')) {
      return {
        valid: false,
        reason: `File extension '.pdf' does not match real file content (${detected.mime}).`,
        code: 'SPOOFED_FILE_TYPE',
        sanitizedFilename
      };
    }

    return {
      valid: true,
      sanitizedFilename,
      mimeType: detected.mime || claimedMimeType || 'application/octet-stream',
      fileType: detected.ext || ext.replace('.', '') || 'unknown',
      category: detected.category || this.mapMimeToCategory(detected.mime)
    };
  }
}

module.exports = FileValidator;
