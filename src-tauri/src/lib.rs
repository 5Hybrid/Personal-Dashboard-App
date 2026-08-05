mod backup;
mod commands;
mod db;
mod external_apps;
mod google;
mod models;
mod notifications;

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;

/// Arg the autostart plugin re-launches the app with at login (see the
/// plugin::init call below) — lets setup() tell "the user double-clicked the
/// icon" apart from "Windows started this at login," so autostart can open
/// straight to the tray instead of popping a window every login.
const AUTOSTART_ARG: &str = "--autostart";

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().enable().map_err(|e| e.to_string())
}

#[tauri::command]
fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().disable().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin registered (Tauri requirement) — without this,
        // double-clicking the icon (or an OS "start" shortcut) while the app is
        // already running in the tray spawns a second process pointed at the same
        // WebView2 profile folder. That second WebView2 environment fails to
        // initialize (profile lock contention) and can leave orphaned
        // msedgewebview2.exe processes behind, which then block the *next* launch
        // too — the app looks alive in Task Manager but never renders a window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("life-os.sqlite3");
            let conn = db::init(&db_path)?;
            app.manage(db::DbState(Mutex::new(conn)));
            app.manage(db::DbPathState(db_path.clone()));

            // The window starts hidden (tauri.conf.json's `visible: false`) so
            // an autostart-triggered launch can go straight to the tray; any
            // other launch (double-clicking the icon, the OS "start" shortcut)
            // shows it immediately, same as before this was added.
            let launched_at_login = std::env::args().any(|a| a == AUTOSTART_ARG);
            if !launched_at_login {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }

            let show_item = MenuItem::with_id(app, "show", "Show Life OS", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            notifications::spawn(app.handle().clone());
            let sync_trigger = google::sync::spawn(app.handle().clone(), db_path.clone());
            app.manage(sync_trigger);
            backup::spawn(db_path.clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of closing so the tray/background process (and
            // its scheduled notifications) keeps running with the window closed.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_item,
            commands::update_item,
            commands::soft_delete_item,
            commands::list_items,
            commands::create_context,
            commands::update_context,
            commands::list_contexts,
            commands::create_inbox_item,
            commands::list_inbox_items,
            commands::delete_inbox_item,
            commands::create_quick_note,
            commands::list_quick_notes,
            commands::delete_quick_note,
            commands::create_note,
            commands::list_notes_for_context,
            commands::delete_note,
            commands::create_personal_record,
            commands::update_personal_record,
            commands::list_personal_records,
            commands::delete_personal_record,
            commands::get_preference,
            commands::set_preference,
            commands::list_preferences,
            google::commands::is_google_connected,
            google::commands::connect_google,
            google::commands::disconnect_google,
            google::commands::sync_now,
            google::commands::list_sync_conflicts,
            google::commands::resolve_conflict,
            google::commands::list_upcoming_calendar_events,
            google::commands::list_upcoming_google_tasks,
            google::commands::list_calendar_events_in_range,
            google::commands::list_calendars,
            backup::backup_now,
            is_autostart_enabled,
            enable_autostart,
            disable_autostart,
            notifications::notify_now,
            external_apps::open_app_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
