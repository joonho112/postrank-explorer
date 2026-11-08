// Catalogue quotes are literal display text. Never allow a quote to match
// part of a number, a signed value, a fraction, a grade vector or a percent.
const INTEGER = "(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)";
const NUMBER = `[+−-]?(?:${INTEGER}(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+−-]?[0-9]+)?`;
const TOKEN = `${NUMBER}(?:(?:/${NUMBER})+|%)?`;
const NUMERIC_TOKEN = new RegExp(`^${TOKEN}$`, "u");
const WORD = /[\p{L}\p{N}_]/u;

export function shortNumericQuote(quote) {
  return quote.length < 3 && NUMERIC_TOKEN.test(quote);
}

export function tryMatcher(text) {
  // Cache the invalid boundaries for all quotes checked against this text.
  const interior = new Set();
  for (const { index, 0: token } of text.matchAll(new RegExp(TOKEN, "gu"))) {
    for (let i = index + 1; i < index + token.length; i++) interior.add(i);
  }
  return quote => {
    if (!/[0-9]/.test(quote)) return text.includes(quote);
    const startsNumeric = /^[+−-]?(?:\.[0-9]|[0-9])/.test(quote);
    const endsNumeric = /[0-9%]$/.test(quote);
    for (let start = text.indexOf(quote); start >= 0; start = text.indexOf(quote, start + 1)) {
      const end = start + quote.length;
      if (interior.has(start) || interior.has(end)) continue;
      if ((startsNumeric && start > 0 && WORD.test(text[start - 1])) ||
          (endsNumeric && end < text.length && WORD.test(text[end]))) continue;
      return true;
    }
    return false;
  };
}
