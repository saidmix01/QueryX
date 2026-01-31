use crate::application::use_cases::SavedQueryUseCase;
use crate::domain::entities::{CreateSavedQueryDto, QueryFolder, SavedQuery, UpdateSavedQueryDto};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn get_saved_queries(
    connection_id: String,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<Vec<SavedQuery>, String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    use_case
        .get_by_connection(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_saved_query(
    id: String,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<SavedQuery, String> {
    let query_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    use_case
        .get_by_id(query_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_saved_query(
    dto: CreateSavedQueryDto,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<SavedQuery, String> {
    use_case.create(dto).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_saved_query(
    id: String,
    dto: UpdateSavedQueryDto,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<SavedQuery, String> {
    let query_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    use_case
        .update(query_id, dto)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_saved_query(
    id: String,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<(), String> {
    let query_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    use_case.delete(query_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_saved_queries_by_tags(
    connection_id: String,
    tags: Vec<String>,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<Vec<SavedQuery>, String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    use_case
        .find_by_tags(id, tags)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_query_folders(
    connection_id: String,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<Vec<QueryFolder>, String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    use_case
        .get_folders(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_query_folder(
    connection_id: String,
    name: String,
    parent_id: Option<String>,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<QueryFolder, String> {
    let id = Uuid::parse_str(&connection_id).map_err(|e| e.to_string())?;
    let parent = parent_id
        .map(|p| Uuid::parse_str(&p))
        .transpose()
        .map_err(|e| e.to_string())?;

    use_case
        .create_folder(id, name, parent)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_query_folder(
    id: String,
    use_case: State<'_, Arc<SavedQueryUseCase>>,
) -> Result<(), String> {
    let folder_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    use_case
        .delete_folder(folder_id)
        .await
        .map_err(|e| e.to_string())
}
