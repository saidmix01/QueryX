use tauri::State;
use std::sync::Mutex;
use std::fs;

pub struct LaunchFile(pub Mutex<Option<String>>);

#[derive(serde::Serialize)]
pub struct LaunchFileContent {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn get_launch_file(state: State<LaunchFile>) -> Result<Option<LaunchFileContent>, String> {
    let file_path_opt = state.0.lock().map_err(|e| e.to_string())?.clone();
    
    if let Some(path) = file_path_opt {
        match fs::read_to_string(&path) {
            Ok(content) => Ok(Some(LaunchFileContent {
                path,
                content,
            })),
            Err(e) => Err(format!("Failed to read file {}: {}", path, e))
        }
    } else {
        Ok(None)
    }
}
