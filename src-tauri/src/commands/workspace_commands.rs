use crate::application::use_cases::WorkspaceUseCase;
use crate::domain::entities::{SaveWorkspaceDto, WorkspaceState};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn save_workspace(
    dto: SaveWorkspaceDto,
    use_case: State<'_, Arc<WorkspaceUseCase>>,
) -> Result<WorkspaceState, String> {
    use_case.save(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace(
    connection_id: String,
    use_case: State<'_, Arc<WorkspaceUseCase>>,
) -> Result<Option<WorkspaceState>, String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    use_case.get(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workspace(
    connection_id: String,
    use_case: State<'_, Arc<WorkspaceUseCase>>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    use_case.delete(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_workspaces(
    use_case: State<'_, Arc<WorkspaceUseCase>>,
) -> Result<Vec<WorkspaceState>, String> {
    use_case.get_all().await.map_err(|e| e.to_string())
}
