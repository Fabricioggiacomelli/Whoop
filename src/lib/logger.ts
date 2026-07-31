/**
 * Logger estruturado (JSON) com redação automática de chaves sensíveis.
 * Nunca loga tokens, senhas ou segredos — ver SECURITY.md §4.
 */

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "accesstokenenc",
  "refreshtokenenc",
  "secret",
  "authorization",
  "cookie",
]);

type LogLevel = "debug" | "info" | "warn" | "error";

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val, depth + 1);
  }
  return result;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
