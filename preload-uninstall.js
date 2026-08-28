/* The bridge for the window the uninstaller opens, and nothing else.
 *
 * The app's own preload hands the renderer everything: installing mods, running tools,
 * writing into the game folder. That window is ours and lives for as long as the app does.
 * This one exists for a few seconds while the app is being removed, so it gets the four
 * calls it needs and no way to reach the rest.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uninstall', {
  /** What there is to remove: how many mods, whether the game is patched, how much data. */
  plan: () => ipcRenderer.invoke('uninstall:plan'),
  /** Do it. `{ revert, mods, data }` - each one exactly what the checkbox said. */
  run: (choices) => ipcRenderer.invoke('uninstall:run', choices),
  /** Finished: let the uninstaller carry on. `wipeData` asks it to take the app's folder too. */
  done: (wipeData) => ipcRenderer.invoke('uninstall:done', !!wipeData),
  /** Changed their mind: the program stays and nothing at all is removed. */
  cancel: () => ipcRenderer.invoke('uninstall:cancel'),
});
