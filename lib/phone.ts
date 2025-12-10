const DIGIT_ONLY = /\D+/g;
const PHONE_PATTERN = /^\d{7,20}$/;

export const PHONE_REQUIREMENTS_TEXT = "Uniquement des chiffres, entre 7 et 20 caractères.";

export type PhoneValidationReason = "missing" | "format";

export type PhoneValidationResult = {
  sanitized: string;
  valid: boolean;
  reason?: PhoneValidationReason;
};

export function sanitizePhoneInput(value: string): string {
  return value.replace(DIGIT_ONLY, "").slice(0, 20);
}

export function validatePhoneNumber(rawValue?: string | null): PhoneValidationResult {
  if (!rawValue) {
    return { sanitized: "", valid: false, reason: "missing" };
  }
  const digits = sanitizePhoneInput(rawValue);
  if (!digits) {
    return { sanitized: "", valid: false, reason: "missing" };
  }
  if (!PHONE_PATTERN.test(digits)) {
    return { sanitized: digits, valid: false, reason: "format" };
  }
  return { sanitized: digits, valid: true };
}
