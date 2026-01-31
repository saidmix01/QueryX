use async_trait::async_trait;
use keyring::Entry;
use uuid::Uuid;

use crate::domain::{CredentialStore, DomainError, KEYCHAIN_SERVICE};

/// Implementación de CredentialStore usando OS Keychain
pub struct KeychainCredentialStore;

impl KeychainCredentialStore {
    pub fn new() -> Self {
        Self
    }

    fn get_entry(&self, connection_id: Uuid) -> Result<Entry, DomainError> {
        Entry::new(KEYCHAIN_SERVICE, &connection_id.to_string())
            .map_err(|e| DomainError::CredentialError { message: e.to_string() })
    }
}

impl Default for KeychainCredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CredentialStore for KeychainCredentialStore {
    async fn store(&self, connection_id: Uuid, password: &str) -> Result<(), DomainError> {
        let entry = self.get_entry(connection_id)?;
        entry
            .set_password(password)
            .map_err(|e| DomainError::CredentialError { message: e.to_string() })
    }

    async fn retrieve(&self, connection_id: Uuid) -> Result<Option<String>, DomainError> {
        let entry = self.get_entry(connection_id)?;
        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(DomainError::CredentialError { message: e.to_string() }),
        }
    }

    async fn delete(&self, connection_id: Uuid) -> Result<(), DomainError> {
        let entry = self.get_entry(connection_id)?;
        match entry.delete_password() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(DomainError::CredentialError { message: e.to_string() }),
        }
    }

    async fn exists(&self, connection_id: Uuid) -> Result<bool, DomainError> {
        let entry = self.get_entry(connection_id)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(DomainError::CredentialError { message: e.to_string() }),
        }
    }

    async fn update(&self, connection_id: Uuid, password: &str) -> Result<(), DomainError> {
        self.store(connection_id, password).await
    }
}
