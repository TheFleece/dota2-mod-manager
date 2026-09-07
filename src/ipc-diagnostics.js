/* One channel, and the biggest handler in the app: the support report.
 *
 * Everything worth having when something does not work, gathered into one zip - the game path,
 * what is installed, the displays and their work areas, the tail of the log, the window sizes,
 * what the updater last said. It is the answer to "it does not work on my machine" that does
 * not need twenty questions first.
 *
 * MM_DIAG_OUT writes the archive straight to a path instead of asking, because a report that
 * can only be produced by a human clicking through a save dialog is a report nobody checks
 * after changing it.
 *
 * Bodies unchanged from main.js.
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');

const { t } = require('./i18n');
const { buildReport, renderSummary, renderDetailed } = require('./diagnostics');

/**
 * @param {object} ctx  everything the report asks about, read late where it changes
 * @param {() => Electron.BrowserWindow} ctx.win
 * @param {() => string[]} ctx.rendererErrors
 * @param {() => string|null} ctx.lastUpdateError
 */
function registerDiagnosticsIpc({
  autoUpdater, catalog, diag, dotaIsRunning, icons, installer, library, logFile, remoteConfig,
  schemaService, settings, toolchain, win, rendererErrors, lastUpdateError,
}) {
  // fire-and-forget: a renderer crash it can't recover from still lands in the log a support
  // report is built from, instead of vanishing with the window
  ipcMain.on('diag:rendererError', (e, msg) => {
    const text = String(msg || '').slice(0, 2000);
    diag(`renderer: ${text}`);
    // Kept apart from the log as well, because in the log they are twenty lines among two
    // thousand. A report that lists them on their own is the difference between "the app
    // does nothing when I click" and a stack trace.
    rendererErrors().push({ at: new Date().toISOString(), text });
    if (rendererErrors().length > 50) rendererErrors().shift();
  });

  /* One button, and inside the archive two reports written for two different readers.
   *
   * SUMMARY.txt is a screen of plain sentences that opens with whether anything is wrong at
   * all, because whoever answers a support message first should not have to read JSON to find
   * out that the game is not where the app thinks it is.
   *
   * REPORT.md is the same data with nothing left out, laid out to be read: every section, the
   * full mod list in load order, the errors the interface reported. That is the one to hand
   * to somebody who is going to work out what actually happened.
   *
   * report.json stays exactly as it was, for anything that wants the raw shape. Nothing about
   * this changes for the user: the same button, the same zip, the same place to send it. */
  ipcMain.handle('diag:export', async () => {
    try {
      const { report, files } = buildReport({
        settings, library, installer, schemaService, catalog, icons,
        app: {
          version: app.getVersion(),
          logFile: logFile(),
          userDataDir: app.getPath('userData'),
          updateError: lastUpdateError(),
        },
        extra: {
          dotaRunning: await dotaIsRunning(),
          rendererErrors: rendererErrors(),
          windows: BrowserWindow.getAllWindows().map((w) => {
            const [width, height] = w.getSize();
            return {
              id: w.id, width, height,
              visible: w.isVisible(), focused: w.isFocused(),
              maximized: w.isMaximized(), minimized: w.isMinimized(),
              url: w.webContents.getURL(),
              zoom: w.webContents.getZoomFactor(),
              crashed: w.webContents.isCrashed(),
            };
          }),
          /* The screen, because "it stops scrolling partway" is often a window taller than
           * the room there is for it. Without this the report shows a window 860 tall and no
           * way to tell whether 860 was ever on the screen. Scale factor included: at 150% a
           * 1080p display has less usable height than a 1366x768 laptop. */
          displays: (() => {
            try {
              return screen.getAllDisplays().map((d) => ({
                id: d.id,
                primary: d.id === screen.getPrimaryDisplay().id,
                size: d.size,
                workArea: d.workArea,
                scaleFactor: d.scaleFactor,
              }));
            } catch (err) { return { error: String(err.message || err) }; }
          })(),
          uiScale: settings.get('uiScale'),
          updater: { available: !!autoUpdater, lastError: lastUpdateError() },
          remoteConfig: (() => {
            try {
              return {
                url: remoteConfig.url,
                switches: Object.fromEntries(remoteConfig.SWITCHABLE.map((k) => [k, remoteConfig.feature(k)])),
                notices: remoteConfig.notices(settings.get('uiLang') || 'en').length,
              };
            } catch (err) { return { error: String(err.message || err) }; }
          })(),
          toolchain: (() => {
            try { return toolchain.installed(); } catch (err) { return { error: String(err.message || err) }; }
          })(),
        },
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      // dev: MM_DIAG_OUT=<path> writes the archive straight there instead of asking. A report
      // that can only be produced by a human clicking through a save dialog is a report nobody
      // checks after changing it.
      const res = process.env.MM_DIAG_OUT
        ? { canceled: false, filePath: process.env.MM_DIAG_OUT }
        : await dialog.showSaveDialog(win(), {
          title: t('Сохранить отчёт для поддержки'),
          defaultPath: `dota2-mod-manager-diag-${stamp}.zip`,
          filters: [{ name: t('Отчёт диагностики'), extensions: ['zip'] }],
        });
      if (res.canceled || !res.filePath) return { cancelled: true };
      const zip = new AdmZip();
      zip.addFile('SUMMARY.txt', Buffer.from(renderSummary(report), 'utf-8'));
      zip.addFile('REPORT.md', Buffer.from(renderDetailed(report, files), 'utf-8'));
      zip.addFile('report.json', Buffer.from(JSON.stringify(report, null, 2)));
      for (const [name, text] of Object.entries(files)) zip.addFile(name, Buffer.from(text, 'utf-8'));
      try { zip.addFile('manifest.json', fs.readFileSync(library.file)); } catch { /* nothing installed yet */ }
      fs.writeFileSync(res.filePath, zip.toBuffer());
      if (!process.env.MM_DIAG_OUT) shell.showItemInFolder(res.filePath);
      return { ok: true, path: res.filePath };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });
}

module.exports = { registerDiagnosticsIpc };
