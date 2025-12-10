const USERNAME_PATTERN = /^[a-zA-Z0-9 ._'-]{3,64}$/;
const SUSPICIOUS_TOKEN_PATTERN =
  /(<|>|script|alert|onerror|onload|\b(select|insert|update|delete|drop|union|sleep)\b|--|;|\/\*|\*\/)/i;

export const USERNAME_REQUIREMENTS_TEXT = "3 to 64 characters. Letters, digits, spaces, . _ ' - only.";

export type UsernameValidationReason = "requirements" | "suspicious";

export type UsernameValidationResult = {
  sanitized: string;
  valid: boolean;
  reason?: UsernameValidationReason;
  suspicious?: boolean;
};

export function validateUsername(rawValue?: string | null): UsernameValidationResult {
  if (!rawValue) {
    return { sanitized: "", valid: false, reason: "requirements" };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { sanitized: "", valid: false, reason: "requirements" };
  }

  const collapsedSpaces = trimmed.replace(/\s+/g, " ");
  const sanitized = collapsedSpaces.replace(/[^a-zA-Z0-9 ._'-]/g, "").slice(0, 64);

  if (SUSPICIOUS_TOKEN_PATTERN.test(trimmed)) {
    return {
      sanitized,
      valid: false,
      suspicious: true,
      reason: "suspicious",
    };
  }

  if (!sanitized || !USERNAME_PATTERN.test(sanitized)) {
    return { sanitized, valid: false, reason: "requirements" };
  }

  return { sanitized, valid: true, suspicious: false };
}
