// Exhibit viewer: opens an exhibit's local address in a Mac window with no title bar and no window
// buttons, so the scene fills the window; it keeps the native rounded corners and shadow. Drag the
// window by its top edge and double-click there to zoom it to the screen; resize it from any edge;
// Cmd+M minimizes, Cmd+H hides, Cmd+Q quits. Usage: exhibit-viewer [url], default http://localhost:5173/.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

/// An invisible strip as tall as the title bar was: the page covers the bar, so the bar no longer
/// receives the drag or the double-click. Tauri's drag-region script handles both.
const DRAG_STRIP: &str = r#"
addEventListener('DOMContentLoaded', () => {
  const strip = document.createElement('div');
  strip.setAttribute('data-tauri-drag-region', '');
  strip.style.cssText = 'position:fixed;left:0;right:0;top:0;height:28px;z-index:2147483647';
  document.body.append(strip);
});
"#;

fn main() {
    let url = std::env::args().nth(1).unwrap_or_else(|| "http://localhost:5173/".into());
    tauri::Builder::default()
        // The window buttons are hidden, so the menu carries Minimize (Cmd+M), Hide and Quit.
        .menu(|app| {
            let app_menu = Submenu::with_items(app, "Exhibit Viewer", true, &[
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ])?;
            let window_menu = Submenu::with_items(app, "Window", true, &[
                &MenuItem::with_id(app, "minimize", "Minimize", true, Some("CmdOrCtrl+M"))?,
            ])?;
            Menu::with_items(app, &[&app_menu, &window_menu])
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "minimize" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
        })
        .setup(move |app| {
            // Fit the screen: 88% of its width at 16:9, or less when the screen is short.
            let (w, h) = app
                .primary_monitor()?
                .map(|m| (m.size().width as f64 / m.scale_factor(), m.size().height as f64 / m.scale_factor()))
                .unwrap_or((1600.0, 900.0));
            let width = (w * 0.88).min(h * 0.88 * 16.0 / 9.0);
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title("Exhibit")
                .inner_size(width, width * 9.0 / 16.0)
                .center()
                .title_bar_style(TitleBarStyle::Overlay)
                .hidden_title(true)
                .initialization_script(DRAG_STRIP)
                .build()?;
            hide_window_buttons(&window);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the viewer failed to start");
}

/// A titled window keeps its rounded corners, shadow, edge resizing and minimizing; only its three
/// buttons are hidden.
#[cfg(target_os = "macos")]
fn hide_window_buttons(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    let Ok(ptr) = window.ns_window() else { return };
    let ns_window = unsafe { &*(ptr as *const NSWindow) };
    for kind in [NSWindowButton::CloseButton, NSWindowButton::MiniaturizeButton, NSWindowButton::ZoomButton] {
        if let Some(button) = ns_window.standardWindowButton(kind) {
            button.setHidden(true);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn hide_window_buttons(_window: &tauri::WebviewWindow) {}
