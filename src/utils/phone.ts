/**
 * Utility functions for formatting and cleaning phone numbers.
 */

/**
 * Formats a phone number string into (xxx) xxx-xxxx format.
 * If input has 11 digits starting with '1', strips the leading '1'.
 * Example: 15595082794 -> (559) 508-2794
 * Example: 5595082794 -> (559) 508-2794
 */
export const formatPhoneNumber = (val: string): string => {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  } else if (digits.length > 11 && digits.startsWith('1')) {
    digits = digits.slice(1, 11);
  } else if (digits.length > 10) {
    digits = digits.slice(0, 10);
  }

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

/**
 * Extracts pure digits from a phone number string for easy copying (xxxxxxxxxx).
 * If input has 11 digits starting with '1', strips the leading '1'.
 * Example: (559) 508-2794 -> 5595082794
 * Example: 15595082794 -> 5595082794
 */
export const getCleanPhoneForCopy = (val: string): string => {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
};
