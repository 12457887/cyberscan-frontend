const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SYMBOL = /[^A-Za-z0-9]/;

export const PASSWORD_REQUIREMENTS_TEXT =
  "At least 8 characters including uppercase, lowercase, number, and symbol.";

type PasswordValidationResult = {
  valid: boolean;
  reason?: "length" | "upper" | "lower" | "digit" | "symbol" | "missing";
};

export function validatePasswordStrength(value?: string | null): PasswordValidationResult {
  if (!value) {
    return { valid: false, reason: "missing" };
  }
  const password = value.trim();
  if (!password) {
    return { valid: false, reason: "missing" };
  }
  if (password.length < 8) {
    return { valid: false, reason: "length" };
  }
  if (!UPPER.test(password)) {
    return { valid: false, reason: "upper" };
  }
  if (!LOWER.test(password)) {
    return { valid: false, reason: "lower" };
  }
  if (!DIGIT.test(password)) {
    return { valid: false, reason: "digit" };
  }
  if (!SYMBOL.test(password)) {
    return { valid: false, reason: "symbol" };
  }
  return { valid: true };
}
