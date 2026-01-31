use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::error::DomainError;

/// Port para almacenamiento seguro de credenciales
/// Implementado usando OS Keychain
#[async_trait]
pub trait CredentialStore: Send + Sync {
    /// Guarda una credencial
    async fn store(&self, connection_id: Uuid, password: &str) -> Result<(), DomainError>;

    /// Obtiene una credencial
    async fn retrieve(&self, connection_id: Uuid) -> Result<Option<String>, DomainError>;

    /// Elimina una credencial
    async fn delete(&self, connection_id: Uuid) -> Result<(), DomainError>;

    /// Verifica si existe una credencial
    async fn exists(&self, connection_id: Uuid) -> Result<bool, DomainError>;

    /// Actualiza una credencial
    async fn update(&self, connection_id: Uuid, password: &str) -> Result<(), DomainError>;
}

/// Identificador del servicio para el keychain
pub const KEYCHAIN_SERVICE: &str = "com.sqlforge.credentials";
