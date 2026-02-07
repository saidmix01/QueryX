export type RiskLevel = 'Bajo' | 'Medio' | 'Alto' | 'Crítico';

function hasWhereClause(sql: string): boolean {
  const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
  if (normalized.startsWith('UPDATE') || normalized.startsWith('DELETE')) {
    return normalized.includes(' WHERE ');
  }
  return true;
}

function isDestructive(sql: string): boolean {
  const n = sql.trim().toUpperCase();
  return (
    n.startsWith('UPDATE') ||
    n.startsWith('DELETE') ||
    n.startsWith('DROP') ||
    n.startsWith('TRUNCATE') ||
    n.startsWith('ALTER')
  );
}

export function classifyRisk(sql: string): RiskLevel {
  const n = sql.trim().toUpperCase();
  if (n.startsWith('SELECT') || n.startsWith('WITH')) return 'Bajo';
  if (n.startsWith('INSERT')) return 'Medio';
  if (n.startsWith('UPDATE') || n.startsWith('DELETE')) {
    return hasWhereClause(sql) ? 'Alto' : 'Crítico';
  }
  if (n.startsWith('DROP') || n.startsWith('TRUNCATE') || n.startsWith('ALTER')) return 'Crítico';
  return isDestructive(sql) ? 'Alto' : 'Bajo';
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'Bajo':
      return '#00e67633';
    case 'Medio':
      return '#ffd54f33';
    case 'Alto':
      return '#ff704333';
    case 'Crítico':
      return '#ef444433';
  }
}

export function riskLabel(level: RiskLevel): string {
  return level;
}
