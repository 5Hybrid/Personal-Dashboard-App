use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// "Pop Out" for an embedded external app: a real, separate native window
/// pointed at the app's own URL — the fallback when an iframe can't be used
/// (or just when the user wants more room), and the reliable escape hatch if
/// an iframed session doesn't survive third-party cookie partitioning (see
/// the External App Widget System plan). Focuses the existing window instead
/// of opening a duplicate if the app is already popped out.
///
/// Deliberately loads `url` as `WebviewUrl::External` under a window label
/// that isn't `"main"` — the app's capabilities (`capabilities/default.json`)
/// only grant Tauri IPC to the `"main"` window, so a third-party site opened
/// this way has no access to this app's commands. That's not an oversight to
/// fix later; it's the correct default for embedding a site we don't control.
#[tauri::command]
pub fn open_app_window(app: AppHandle, id: String, url: String, title: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&id) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, id, WebviewUrl::External(parsed))
        .title(title)
        .inner_size(900.0, 700.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
