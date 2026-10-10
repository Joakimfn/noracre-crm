import { sql, type SQLWrapper } from 'drizzle-orm';
import { normalizeRegistryId } from './prospect-import';

/** Match imported SIRET establishments to the same French legal company. */
export function outboundRegistryExpression(number: SQLWrapper, country: SQLWrapper) {
  let compact = sql`upper(${number})`;
  for (const whitespace of [' ', '\t', '\n', '\r', '\u00a0', '\u202f', '\u2007']) {
    // These are fixed constants, not user input. Repeating bound whitespace
    // parameters in joins would exceed D1's 100-parameter limit.
    compact = sql`replace(${compact}, char(${sql.raw(String(whitespace.charCodeAt(0)))}), '')`;
  }
  const french = sql`replace(replace(${compact}, '.', ''), '-', '')`;
  return sql<string>`case when ${country} = 'FR' and length(${french}) in (9, 14) and ${french} not glob '*[^0-9]*' then substr(${french}, 1, 9) else ${compact} end`;
}

export function outboundCompanyKey(entry: { id: number; country: string; orgNumber: string }) {
  const number = normalizeRegistryId(entry.orgNumber, entry.country);
  return number ? `${entry.country}:${number}` : `entry:${entry.id}`;
}
