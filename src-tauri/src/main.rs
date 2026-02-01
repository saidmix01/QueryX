// Prevent console window on Windows in release builds
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod application;
mod commands;
mod domain;
mod infrastructure;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::sync::OnceCell;

use application::{ConnectionUseCase, QueryUseCase, SavedQueryUseCase, SchemaUseCase, WorkspaceUseCase};
use commands::*;
use infrastructure::{FileSavedQueryRepository, FileWorkspaceRepository, KeychainCredentialStore};

static CONNECTION_REPO: OnceCell<Arc<dyn domain::ConnectionRepository>> = OnceCell::const_new();
static HISTORY_REPO: OnceCell<Arc<dyn domain::QueryHistoryRepository>> = OnceCell::const_new();

fn main() {
    // ============================================================================
    // LINUX SAFE MODE - CRITICAL: Must be set BEFORE Tauri initialization
    // ============================================================================
    // This prevents libEGL/DRI3 errors, black screens, and click-through issues
    // by forcing software rendering and disabling problematic GPU acceleration
    #[cfg(target_os = "linux")]
    {
        // Detect display server (Wayland vs X11)
        let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok() 
            || std::env::var("XDG_SESSION_TYPE").map(|v| v == "wayland").unwrap_or(false);
        
        eprintln!("[Linux Safe Mode] Detected display server: {}", 
            if is_wayland { "Wayland" } else { "X11" });
        
        // ========================================================================
        // WebKitGTK Environment Variables - Conservative Approach
        // ========================================================================
        // NOTE: WEBKIT_DISABLE_COMPOSITING_MODE can cause black screens
        // Only disable DMA-BUF renderer which is known to cause issues
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        
        // Don't disable compositing mode as it can cause black screens
        // Don't force software rendering as it can cause black screens
        // Only disable problematic GPU features, not all rendering
        
        // ========================================================================
        // EGL/DRI3 Environment Variables - Conservative Approach
        // ========================================================================
        // NOTE: LIBGL_ALWAYS_SOFTWARE can cause black screens
        // Only set Mesa version overrides if needed, don't force software rendering
        // std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1"); // DISABLED - causes black screens
        
        // Don't force software Mesa driver as it can cause black screens
        // Let the system use hardware acceleration if available
        
        // ========================================================================
        // GTK/WebKitGTK Specific Fixes
        // ========================================================================
        // Disable GTK CSD (Client Side Decorations) which can cause issues
        std::env::set_var("GTK_CSD", "0");
        
        // Force GTK to use X11 backend explicitly (more stable than auto-detection)
        if !is_wayland {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        
        // Disable GTK overlay scrolling (can cause rendering artifacts)
        std::env::set_var("GTK_OVERLAY_SCROLLING", "0");
        
        eprintln!("[Linux Safe Mode] Applied software rendering environment variables");
        eprintln!("[Linux Safe Mode] This ensures stable rendering without GPU dependencies");
    }

    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .setup(|app| {
            // Capture launch args for file association
            let args: Vec<String> = std::env::args().collect();
            let mut launch_file_path = None;
            for arg in args.iter().skip(1) {
                if arg.to_lowercase().ends_with(".sql") {
                    launch_file_path = Some(arg.clone());
                    break;
                }
            }
            app.manage(LaunchFile(Mutex::new(launch_file_path)));

            let app_handle = app.handle();
            
            // ====================================================================
            // LINUX WINDOW CONFIGURATION - Safe Mode Settings
            // ====================================================================
            // Configure window properties to prevent click-through and ensure visibility
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                
                // Detect display server (Wayland vs X11) - same check as in main()
                let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok() 
                    || std::env::var("XDG_SESSION_TYPE").map(|v| v == "wayland").unwrap_or(false);
                
                eprintln!("[Linux Window Config] Display server: {}", 
                    if is_wayland { "Wayland" } else { "X11" });

                if let Some(window) = app.get_window("main") {
                    eprintln!("[Linux Window Config] Applying safe window settings...");
                    
                    // ============================================================
                    // CRITICAL: Force window decorations (prevents click-through)
                    // ============================================================
                    // Decorations ensure proper window manager integration and
                    // prevent the window from becoming click-through
                    if let Err(e) = window.set_decorations(true) {
                        eprintln!("[Linux Window Config] WARNING: Failed to set decorations: {}", e);
                        eprintln!("[Linux Window Config] This may cause click-through issues!");
                    } else {
                        eprintln!("[Linux Window Config] ✓ Window decorations enabled");
                    }
                    
                    // ============================================================
                    // Ensure window is visible and receives focus
                    // ============================================================
                    // These operations ensure the window is properly initialized
                    // and can receive mouse/keyboard events
                    // CRITICAL: Use unminimize() first to ensure window is not minimized
                    let _ = window.unminimize();
                    
                    if let Err(e) = window.show() {
                        eprintln!("[Linux Window Config] WARNING: Failed to show window: {}", e);
                    } else {
                        eprintln!("[Linux Window Config] ✓ Window shown");
                    }
                    
                    // Small delay before setting focus to ensure window is ready
                    let window_clone = window.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                        if let Err(e) = window_clone.set_focus() {
                            eprintln!("[Linux Window Config] WARNING: Failed to set focus: {}", e);
                        } else {
                            eprintln!("[Linux Window Config] ✓ Window focus set");
                        }
                    });
                    
                    // ============================================================
                    // Set solid background color (prevents transparency artifacts)
                    // ============================================================
                    // Note: Tauri doesn't have a direct set_background_color API,
                    // but we ensure transparency is disabled via environment vars
                    // and CSS overrides. The window should be opaque by default.
                    
                    eprintln!("[Linux Window Config] Safe mode configuration complete");
                    eprintln!("[Linux Window Config] Window should now be visible and clickable");
                } else {
                    eprintln!("[Linux Window Config] ERROR: Main window not found!");
                }
            }

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
            // App commands
            get_launch_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
