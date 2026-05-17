// Rehearsal mark label utilities

export function counterToLetter(n) {
  let result = '';
  n = n + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function toRoman(n) {
  if (n <= 0) return '';
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

export function labelForMark(index, bar, style) {
  if (style === 'letters') return counterToLetter(index);
  if (style === 'numbers') return String(index + 1);
  if (style === 'roman')   return toRoman(index + 1);
  // 'bars' — use the actual bar number
  return Number.isInteger(bar) ? String(bar) : bar.toFixed(1);
}

// Re-label every mark in bar order. Always call this after adding or removing a mark,
// and when changing the mark style, so labels are always sequential and in order.
export function relabelMarks(marks, style) {
  return [...marks]
    .sort((a, b) => a.bar - b.bar)
    .map((mark, i) => ({ ...mark, label: labelForMark(i, mark.bar, style) }));
}
