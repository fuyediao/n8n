import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import { initI18n, t } from './i18n';

let mainWindow: BrowserWindow | null = null;
let n8nProcess: ChildProcess | null = null;
const N8N_PORT = 5678;
const N8N_URL = `http://localhost:${N8N_PORT}`;

/**
 * Create the main application window
 */
function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
		title: 'n8n',
	});

	// Show loading page first (using i18n)
	const loadingTitle = t('app.starting');
	const loadingDescription = t('app.startingDescription');

	mainWindow.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>n8n - ${loadingTitle}</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
						background: #f5f5f5;
						color: #333;
					}
					h1 { margin-bottom: 20px; }
					.spinner {
						border: 4px solid #f3f3f3;
						border-top: 4px solid #3498db;
						border-radius: 50%;
						width: 40px;
						height: 40px;
						animation: spin 1s linear infinite;
						margin: 20px auto;
					}
					@keyframes spin {
						0% { transform: rotate(0deg); }
						100% { transform: rotate(360deg); }
					}
				</style>
			</head>
			<body>
				<h1>${loadingTitle}</h1>
				<div class="spinner"></div>
				<p>${loadingDescription}</p>
			</body>
			</html>
		`)}`,
	);

	// Load n8n UI once server is ready
	waitForServer(() => {
		if (mainWindow) {
			mainWindow.loadURL(N8N_URL);
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Open DevTools in a new window in development
	if (process.env.NODE_ENV === 'development') {
		// Use 'detach' mode to open DevTools in a separate window
		mainWindow.webContents.openDevTools({ mode: 'detach' });
	}
}

/**
 * Wait for n8n server to be ready
 */
function waitForServer(callback: () => void, maxAttempts = 60): void {
	let attempts = 0;

	const checkServer = () => {
		attempts++;
		const req = http.get(N8N_URL, { timeout: 2000 }, (res) => {
			if (res.statusCode === 200 || res.statusCode === 302) {
				callback();
			} else {
				if (attempts < maxAttempts) {
					setTimeout(checkServer, 1000);
				} else {
					console.error('Failed to start n8n server');
					if (mainWindow) {
						const errorTitle = t('app.error');
						const errorDescription = t('app.errorDescription');

						mainWindow.loadURL(
							`data:text/html;charset=utf-8,${encodeURIComponent(`
								<!DOCTYPE html>
								<html>
								<head>
									<meta charset="UTF-8">
									<title>n8n - ${errorTitle}</title>
									<style>
										body {
											font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
											display: flex;
											flex-direction: column;
											align-items: center;
											justify-content: center;
											height: 100vh;
											margin: 0;
											background: #f5f5f5;
											color: #d32f2f;
										}
									</style>
								</head>
								<body>
									<h1>${errorTitle}</h1>
									<p>${errorDescription}</p>
								</body>
								</html>
							`)}`,
						);
					}
				}
			}
		});

		req.on('error', () => {
			if (attempts < maxAttempts) {
				setTimeout(checkServer, 1000);
			} else {
				console.error('Failed to start n8n server after', maxAttempts, 'attempts');
				if (mainWindow) {
					const errorTitle = t('app.error');
					const errorMessage = t('app.errorAfterAttempts', undefined, { attempts: maxAttempts });

					mainWindow.loadURL(
						`data:text/html;charset=utf-8,${encodeURIComponent(`
							<!DOCTYPE html>
							<html>
							<head>
								<meta charset="UTF-8">
								<title>n8n - ${errorTitle}</title>
								<style>
									body {
										font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
										display: flex;
										flex-direction: column;
										align-items: center;
										justify-content: center;
										height: 100vh;
										margin: 0;
										background: #f5f5f5;
										color: #d32f2f;
									}
								</style>
							</head>
							<body>
								<h1>${errorTitle}</h1>
								<p>${errorMessage}</p>
							</body>
							</html>
						`)}`,
					);
				}
			}
		});

		req.on('timeout', () => {
			req.destroy();
			if (attempts < maxAttempts) {
				setTimeout(checkServer, 1000);
			}
		});
	};

	setTimeout(checkServer, 2000);
}

/**
 * Stop process using the specified port (Windows)
 */
async function stopProcessOnPort(port: number): Promise<void> {
	if (process.platform !== 'win32') {
		// On non-Windows, we could use lsof, but for now just skip
		return;
	}

	try {
		const { execSync } = require('child_process');
		// Find process ID using the port
		const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });

		const lines = result.trim().split('\n');
		const pids = new Set<string>();

		for (const line of lines) {
			const match = line.match(/\s+(\d+)\s*$/);
			if (match) {
				const pid = match[1];
				// Don't kill our own process
				if (pid !== String(process.pid)) {
					pids.add(pid);
				}
			}
		}

		// Kill all processes using the port
		for (const pid of pids) {
			try {
				execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
				console.log(`Stopped process ${pid} using port ${port}`);
			} catch {
				// Process might already be gone, ignore
			}
		}

		// Wait a bit for the port to be released
		if (pids.size > 0) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	} catch {
		// No process found or error, that's okay
	}
}

/**
 * Start n8n backend server
 */
async function startN8nServer(): Promise<void> {
	// Stop any process using the port first
	await stopProcessOnPort(N8N_PORT);
	// Find n8n CLI path - try multiple possible locations
	let n8nCliPath: string;
	try {
		n8nCliPath = require.resolve('n8n/bin/n8n');
	} catch {
		// Fallback: try to find it relative to the app
		const possiblePaths = [
			path.join(__dirname, '../../cli/bin/n8n'),
			path.join(process.cwd(), 'packages/cli/bin/n8n'),
		];
		n8nCliPath =
			possiblePaths.find((p) => {
				try {
					require.resolve(p);
					return true;
				} catch {
					return false;
				}
			}) || possiblePaths[0];
	}

	// Use system Node.js instead of Electron's bundled Node.js
	// Electron's Node.js version may not meet n8n's requirements
	// We'll use 'node' command which will be resolved from PATH by the shell
	const nodePath = 'node';

	console.log('Starting n8n server...');
	console.log('N8N CLI Path:', n8nCliPath);
	console.log('Node Path:', nodePath);

	// Set user data directory to app's userData
	const userDataPath = path.join(app.getPath('userData'), '.n8n');
	process.env.N8N_USER_FOLDER = userDataPath;

	// Start n8n process
	// Use shell on Windows for better compatibility and to resolve 'node' from PATH
	const spawnOptions: any = {
		env: {
			...process.env,
			N8N_USER_FOLDER: userDataPath,
			N8N_PORT: String(N8N_PORT),
			// Ensure we use system Node.js, not Electron's bundled version
			ELECTRON_RUN_AS_NODE: undefined,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		cwd: path.dirname(n8nCliPath),
		detached: false,
	};

	// Always use shell to resolve 'node' from PATH and handle paths with spaces
	// On Windows, shell: true will use cmd.exe which can handle PATH resolution
	spawnOptions.shell = true;

	// Build the command as a string for shell execution
	// This ensures paths with spaces are handled correctly
	const command = `"${nodePath}" "${n8nCliPath}" start`;

	n8nProcess = spawn(command, [], spawnOptions);

	n8nProcess.stdout?.on('data', (data) => {
		console.log(`n8n: ${data.toString()}`);
	});

	n8nProcess.stderr?.on('data', (data) => {
		console.error(`n8n error: ${data.toString()}`);
	});

	n8nProcess.on('close', (code) => {
		console.log(`n8n process exited with code ${code}`);
		if (code !== 0 && code !== null) {
			console.error('n8n server exited unexpectedly');
		}
	});

	n8nProcess.on('error', (error) => {
		console.error('Failed to start n8n:', error);
	});
}

/**
 * Stop n8n backend server
 */
function stopN8nServer(): void {
	if (n8nProcess) {
		n8nProcess.kill();
		n8nProcess = null;
	}
}

// App event handlers
app.whenReady().then(async () => {
	// Initialize i18n
	initI18n('en');

	await startN8nServer();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		stopN8nServer();
		app.quit();
	}
});

app.on('before-quit', () => {
	stopN8nServer();
});

// IPC handlers
ipcMain.handle('get-n8n-url', () => {
	return N8N_URL;
});

ipcMain.handle('restart-n8n', async () => {
	stopN8nServer();
	await stopProcessOnPort(N8N_PORT);
	await new Promise((resolve) => setTimeout(resolve, 1000));
	await startN8nServer();
	return true;
});
