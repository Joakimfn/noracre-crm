import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

test('spreadsheet export keeps formula-like user text as text', () => {
  const sheet = XLSX.utils.json_to_sheet([{ name: '=HYPERLINK("https://example.invalid", "test")' }]);
  assert.equal(sheet.A2.t, 's');
  assert.equal(sheet.A2.f, undefined);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Kunder');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const parsed = XLSX.read(bytes, { sheetRows: 501, sheets: 0 });
  assert.equal(parsed.Sheets.Kunder.A2.t, 's');
  assert.equal(parsed.Sheets.Kunder.A2.f, undefined);
});

test('spreadsheet import caps parsed rows before conversion', () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(Array.from({length: 600}, (_, id) => ({name: `Kunde ${id}`}))), 'Kunder');
  const parsed = XLSX.read(XLSX.write(book, {type: 'array', bookType: 'xlsx'}), {sheetRows: 501, sheets: 0});
  assert.equal(XLSX.utils.sheet_to_json(parsed.Sheets.Kunder).length, 500);
});
