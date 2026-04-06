/**
 * Convert a Czech bank account number to IBAN format.
 * Accepts formats: "prefix-number/bankCode", "number/bankCode", or a raw CZ IBAN.
 */
export const convertToCZIBAN = (accountStr: string): string | null => {
  if (!accountStr) return null;
  const cleanStr = accountStr.replace(/\s/g, '');
  if (/^CZ\d{22}$/.test(cleanStr)) return cleanStr;
  const match = cleanStr.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!match) return null;
  const prefix = (match[1] || '').padStart(6, '0');
  const number = match[2].padStart(10, '0');
  const bankCode = match[3].padStart(4, '0');
  const bban = bankCode + prefix + number;
  const numericString = bban + '123500';
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
  }
  const checkDigits = (98 - remainder).toString().padStart(2, '0');
  return `CZ${checkDigits}${bban}`;
};

