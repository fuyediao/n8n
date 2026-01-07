import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld('electronAPI', {
	getN8nUrl: () => ipcRenderer.invoke('get-n8n-url'),
	restartN8n: () => ipcRenderer.invoke('restart-n8n'),
});
