// ─── App-wide constants ───────────────────────────────────────────────────────
// Mirrors src/lib/constants.ts from the Svelte app.

export const APP_NAME = 'Bodhion';

/** URL paths */
export const DASHBOARD_HOME = '/';
export const CHAT_ENGINE_HOME = '/chat-engine';
export const AUTH_PATH = '/login';

/** Mobile breakpoint in px (matches Svelte app BREAKPOINT = 768). */
export const MOBILE_BREAKPOINT = 768;

/** Token expiry check buffer in seconds (matches Svelte app TOKEN_EXPIRY_BUFFER = 60). */
export const TOKEN_EXPIRY_BUFFER = 60;

/** Default sidebar width in px. */
export const DEFAULT_SIDEBAR_WIDTH = 260;

/** Supported file types for upload (mirrors SUPPORTED_FILE_TYPE in Svelte constants). */
export const SUPPORTED_FILE_TYPES = [
  'application/epub+zip',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/xml',
  'text/html',
  'text/x-python',
  'text/css',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/x-javascript',
  'text/markdown',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
];

export const SUPPORTED_FILE_EXTENSIONS = [
  'md', 'rst', 'go', 'py', 'java', 'sh', 'bat', 'ps1', 'cmd', 'js', 'ts',
  'css', 'cpp', 'hpp', 'h', 'c', 'cs', 'htm', 'html', 'sql', 'log', 'ini',
  'pl', 'pm', 'r', 'dart', 'dockerfile', 'env', 'php', 'hs', 'lua', 'conf',
  'rb', 'rs', 'scala', 'bash', 'swift', 'vue', 'svelte', 'doc', 'docx',
  'pdf', 'csv', 'txt', 'xls', 'xlsx', 'pptx', 'ppt', 'msg',
];
