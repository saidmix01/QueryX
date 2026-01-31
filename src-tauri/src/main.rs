// Prevent console window on Windows in release builds
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod application;
mod commands;
mod domain;
mod infrastructure;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::OnceCell;

use application::{ConnectionUseCase, QueryUseCase, SavedQueryUseCase, SchemaUseCase, WorkspaceUseCase};
use commands::*;
use infrastructure::{FileSavedQueryRepository, FileWorkspaceRepository, KeychainCredentialStore};

static CONNECTION_REPO: OnceCell<Arc<dyn domain::ConnectionRepository>> = OnceCell::const_new();
static HISTORY_REPO: OnceCell<Arc<dyn domain::QueryHistoryRepository>> = OnceCell::const_new();

fn main() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let data_dir = app_handle
                .path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let data_dir_clone = data_dir.clone();
            
            // Crear repositorios de forma síncrona usando std::fs
            std::fs::create_dir_all(&data_dir).ok();

            // Inicializar con valores por defecto, la carga real será lazy
            let credential_store = Arc::new(KeychainCredentialStore::new()) 
                as Arc<dyn domain::CredentialStore>;

            // Crear casos de uso con inicialización lazy
            let connection_use_case = Arc::new(ConnectionUseCase::new_lazy(
                data_dir.clone(),
                credential_store,
            ));

            let query_use_case = Arc::new(QueryUseCase::new_lazy(
                connection_use_case.clone(),
                data_dir_clone,
            ));

            let schema_use_case = Arc::new(SchemaUseCase::new(connection_use_case.clone()));

            // Crear repositorios para consultas guardadas y workspace
            let saved_query_repo = Arc::new(FileSavedQueryRepository::new(
                data_dir.join("saved_queries.json")
            ));

            let workspace_repo = Arc::new(FileWorkspaceRepository::new(
                data_dir.join("workspaces.json")
            ));

            // Inicializar repositorios de forma asíncrona
            let saved_query_repo_clone = saved_query_repo.clone();
            let workspace_repo_clone = workspace_repo.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = saved_query_repo_clone.initialize().await {
                    eprintln!("Failed to initialize saved query repository: {}", e);
                }
                if let Err(e) = workspace_repo_clone.initialize().await {
                    eprintln!("Failed to initialize workspace repository: {}", e);
                }
            });

            let saved_query_use_case = Arc::new(SavedQueryUseCase::new(saved_query_repo));
            let workspace_use_case = Arc::new(WorkspaceUseCase::new(workspace_repo));

            // Registrar estados
            app.manage(connection_use_case);
            app.manage(query_use_case);
            app.manage(schema_use_case);
            app.manage(saved_query_use_case);
            app.manage(workspace_use_case);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection commands
            get_connections,
            get_connection,
            create_connection,
            update_connection,
            delete_connection,
            test_connection,
            connect,
            disconnect,
            get_connection_status,
            // Query commands
            execute_query,
            execute_statement,
            execute_multi_statement,
            execute_in_transaction,
            get_query_history,
            search_query_history,
            cancel_query,
            // Schema commands
            list_databases,
            get_database_info,
            list_schemas,
            list_tables,
            get_table_info,
            get_columns,
            list_indexes,
            list_constraints,
            list_triggers,
            list_views,
            list_functions,
            list_sequences,
            get_server_version,
            // Saved query commands
            get_saved_queries,
            get_saved_query,
            create_saved_query,
            update_saved_query,
            delete_saved_query,
            find_saved_queries_by_tags,
            get_query_folders,
            create_query_folder,
            delete_query_folder,
            // Workspace commands
            save_workspace,
            get_workspace,
            delete_workspace,
            get_all_workspaces,
            // Export commands
            export_results_xlsx,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
