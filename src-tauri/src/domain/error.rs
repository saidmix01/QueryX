use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errores del dominio
#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum DomainError {
    #[error("Connection error: {message}")]
    ConnectionError { message: String, code: Option<String> },

    #[error("Query execution error: {message}")]
    QueryError { message: String, position: Option<u32> },

    #[error("Authentication failed: {message}")]
    AuthenticationError { message: String },

    #[error("Connection not found: {id}")]
    ConnectionNotFound { id: String },

    #[error("Driver not found: {engine}")]
    DriverNotFound { engine: String },

    #[error("Invalid configuration: {message}")]
    ConfigurationError { message: String },

    #[error("Timeout: {operation}")]
    Timeout { operation: String },

    #[error("Permission denied: {resource}")]
    PermissionDenied { resource: String },

    #[error("Resource not found: {resource}")]
    NotFound { resource: String },

    #[error("Validation error: {message}")]
    ValidationError { message: String },

    #[error("Credential store error: {message}")]
    CredentialError { message: String },

    #[error("Serialization error: {message}")]
    SerializationError { message: String },

    #[error("IO error: {message}")]
    IoError { message: String },

    #[error("Pool exhausted")]
    PoolExhausted,

    #[error("Operation cancelled")]
    Cancelled,

    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl DomainError {
    pub fn connection(message: impl Into<String>) -> Self {
        Self::ConnectionError {
            message: message.into(),
            code: None,
        }
    }

    pub fn query(message: impl Into<String>) -> Self {
        Self::QueryError {
            message: message.into(),
            position: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::ValidationError {
            message: message.into(),
        }
    }

    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound {
            resource: resource.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            DomainError::ConnectionError { .. }
                | DomainError::Timeout { .. }
                | DomainError::PoolExhausted
        )
    }

    pub fn error_code(&self) -> &'static str {
        match self {
            DomainError::ConnectionError { .. } => "CONNECTION_ERROR",
            DomainError::QueryError { .. } => "QUERY_ERROR",
            DomainError::AuthenticationError { .. } => "AUTH_ERROR",
            DomainError::ConnectionNotFound { .. } => "CONNECTION_NOT_FOUND",
            DomainError::DriverNotFound { .. } => "DRIVER_NOT_FOUND",
            DomainError::ConfigurationError { .. } => "CONFIG_ERROR",
            DomainError::Timeout { .. } => "TIMEOUT",
            DomainError::PermissionDenied { .. } => "PERMISSION_DENIED",
            DomainError::NotFound { .. } => "NOT_FOUND",
            DomainError::ValidationError { .. } => "VALIDATION_ERROR",
            DomainError::CredentialError { .. } => "CREDENTIAL_ERROR",
            DomainError::SerializationError { .. } => "SERIALIZATION_ERROR",
            DomainError::IoError { .. } => "IO_ERROR",
            DomainError::PoolExhausted => "POOL_EXHAUSTED",
            DomainError::Cancelled => "CANCELLED",
            DomainError::Internal { .. } => "INTERNAL_ERROR",
        }
    }
}

impl From<std::io::Error> for DomainError {
    fn from(err: std::io::Error) -> Self {
        DomainError::IoError {
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for DomainError {
    fn from(err: serde_json::Error) -> Self {
        DomainError::SerializationError {
            message: err.to_string(),
        }
    }
}
