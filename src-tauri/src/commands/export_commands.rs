use serde_json::Value;
use umya_spreadsheet::{self as excel, Worksheet};

fn index_to_column_letters(mut col: u32) -> String {
    let mut s = String::new();
    while col > 0 {
        let rem = (col - 1) % 26;
        s.insert(0, (b'A' + rem as u8) as char);
        col = (col - 1) / 26;
    }
    s
}

fn set_cell_text(sheet: &mut Worksheet, row: u32, col: u32, text: String) {
    let col_letters = index_to_column_letters(col);
    let coordinate = format!("{}{}", col_letters, row);
    sheet.get_cell_mut(coordinate).set_value(text);
}

#[tauri::command]
pub async fn export_results_xlsx(columns: Vec<String>, rows: Vec<Vec<Value>>, path: String) -> Result<(), String> {
    let mut book = excel::new_file();
    let sheet_name = "Sheet1";
    let sheet = book
        .get_sheet_by_name_mut(sheet_name)
        .map_err(|e| e.to_string())?;

    for (i, col_name) in columns.iter().enumerate() {
        set_cell_text(sheet, 1, (i as u32) + 1, col_name.to_string());
    }

    for (r_idx, row) in rows.iter().enumerate() {
        let row_num = (r_idx as u32) + 2;
        for (c_idx, cell) in row.iter().enumerate() {
            let col_num = (c_idx as u32) + 1;
            let text = match cell {
                Value::Null => "".to_string(),
                Value::Bool(b) => if *b { "TRUE".to_string() } else { "FALSE".to_string() },
                Value::Number(n) => n.to_string(),
                Value::String(s) => s.to_string(),
                Value::Array(a) => serde_json::to_string(a).unwrap_or_default(),
                Value::Object(o) => serde_json::to_string(o).unwrap_or_default(),
            };
            set_cell_text(sheet, row_num, col_num, text);
        }
    }

    excel::writer::xlsx::write(&book, &path).map_err(|e| e.to_string())
}
