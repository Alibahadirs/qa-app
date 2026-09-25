/**
 * RFC 4180'e göre tek hücre kaçışı. Excel/Sheets `= + - @` (ve sekme/CR) ile
 * başlayan hücreyi formül sayar; kullanıcı girdisi (not, başlık) bu yolla
 * çalıştırılabilir bir formüle dönüşmesin diye başına `'` eklenir.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV metni üretir. Excel'in Türkçe yerel ayarında ayıracı doğru seçmesi ve
 * UTF-8 karakterleri bozmaması için `sep=;` satırı ve BOM eklenir.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  return `﻿sep=;\r\n${lines.join('\r\n')}\r\n`;
}

export const csvFilename = (base: string): string =>
  `${base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80)}.csv`;
