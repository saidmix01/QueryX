// Tipos para consultas guardadas

export interface SavedQuery {
  id: string;
  connection_id: string;
  name: string;
  sql: string;
  description?: string;
  tags: string[];
  folder_id?: string;
  created_at: string;
  updated_at: string;
}

export interface QueryFolder {
  id: string;
  connection_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

export interface CreateSavedQueryDto {
  connection_id: string;
  name: string;
  sql: string;
  description?: string;
  tags?: string[];
  folder_id?: string;
}

export interface UpdateSavedQueryDto {
  name?: string;
  sql?: string;
  description?: string;
  tags?: string[];
  folder_id?: string;
}
