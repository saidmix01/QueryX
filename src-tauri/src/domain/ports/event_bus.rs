use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::ConnectionStatus;
use crate::domain::error::DomainError;

/// Eventos del sistema
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum DomainEvent {
    // Eventos de conexión
    ConnectionCreated { connection_id: Uuid },
    ConnectionUpdated { connection_id: Uuid },
    ConnectionDeleted { connection_id: Uuid },
    ConnectionStatusChanged { connection_id: Uuid, status: ConnectionStatus },

    // Eventos de query
    QueryStarted { connection_id: Uuid, query_id: Uuid },
    QueryCompleted { connection_id: Uuid, query_id: Uuid, row_count: usize },
    QueryFailed { connection_id: Uuid, query_id: Uuid, error: String },
    QueryCancelled { connection_id: Uuid, query_id: Uuid },

    // Eventos de schema
    SchemaRefreshed { connection_id: Uuid },
    TableSelected { connection_id: Uuid, table: String },

    // Eventos de UI
    ThemeChanged { theme: String },
    SettingsUpdated,
}

/// Suscriptor de eventos
pub type EventHandler = Box<dyn Fn(DomainEvent) + Send + Sync>;

/// Event Bus para comunicación desacoplada
#[async_trait]
pub trait EventBus: Send + Sync {
    /// Publica un evento
    async fn publish(&self, event: DomainEvent) -> Result<(), DomainError>;

    /// Suscribe un handler a todos los eventos
    fn subscribe(&self, handler: EventHandler) -> Uuid;

    /// Cancela una suscripción
    fn unsubscribe(&self, subscription_id: Uuid);

    /// Obtiene el número de suscriptores
    fn subscriber_count(&self) -> usize;
}
