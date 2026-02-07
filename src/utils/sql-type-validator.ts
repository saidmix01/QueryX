import { schemaApi } from '../infrastructure/tauri-api';

function isUuidString(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function validateUpdateLiterals(
  connectionId: string,
  sql: string,
  schema?: string
): Promise<{ warnings: string[]; critical: boolean }> {
  const warnings: string[] = [];
  let critical = false;

  const m = sql.match(/^\s*UPDATE\s+([^\s]+)\s+SET\s+([\s\S]+?)\s+WHERE/i);
  if (!m) return { warnings, critical };
  const tableToken = m[1];
  const setBlock = m[2];

  let table = tableToken;
  if (tableToken.includes('.')) {
    const parts = tableToken.split('.');
    schema = schema || parts[0].replace(/^["`]/, '').replace(/["`]$/, '');
    table = parts[1];
  }
  const cleanTable = table.replace(/^["`]/, '').replace(/["`]$/, '');

  const cols = await schemaApi.getColumns(connectionId, cleanTable, schema);
  const typeMap = new Map<string, string>();
  cols.forEach((c) => typeMap.set(c.name.toLowerCase(), String(c.data_type || '').toLowerCase()));

  const regex =
    /(?:"([^"]+)"|`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*))\s*=\s*(?:'([^']*)'|([0-9]+(?:\.[0-9]+)?)|TRUE|FALSE)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(setBlock)) !== null) {
    const col =
      (match[1] || match[2] || match[3] || '').toString().trim();
    const strVal = match[4];
    const numVal = match[5];
    const type = typeMap.get(col.toLowerCase()) || '';
    if (type.includes('uuid')) {
      if (typeof strVal !== 'string' || !isUuidString(strVal)) {
        warnings.push(`La columna "${col}" es UUID, el valor "${strVal ?? numVal ?? ''}" no es un UUID válido`);
        critical = true;
      }
    }
  }

  return { warnings, critical };
}
