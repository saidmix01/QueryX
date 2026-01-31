use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::entities::QueryHistoryEntry;
use crate::domain::error::DomainError;

/// Repository para historial de queries
#[async_trait]
pub trait QueryHistoryRepository: Send + Sync {
    /// Guarda una entrada en el historial
    async fn save(&self, entry: QueryHistoryEntry) -> Result<(), DomainError>;

    /// Obtiene el historial de una conexión
    async fn get_by_connection(
        &self,
        connection_id: Uuid,
        limit: usize,
    ) -> Result<Vec<QueryHistoryEntry>, DomainError>;

    /// Obtiene todo el historial paginado
    async fn get_all(&self, limit: usize, offset: usize) -> Result<Vec<QueryHistoryEntry>, DomainError>;

    /// Busca en el historial
    async fn search(&self, query: &str, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError>;

    /// Obtiene queries favoritas/frecuentes
    async fn get_frequent(&self, connection_id: Option<Uuid>, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError>;

    /// Elimina entradas antiguas
    async fn cleanup_older_than(&self, date: DateTime<Utc>) -> Result<u64, DomainError>;

    /// Elimina todo el historial de una conexión
    async fn delete_by_connection(&self, connection_id: Uuid) -> Result<(), DomainError>;

    /// Elimina una entrada específica
    async fn delete(&self, id: Uuid) -> Result<(), DomainError>;

    /// Cuenta el total de entradas
    async fn count(&self) -> Result<u64, DomainError>;
}
