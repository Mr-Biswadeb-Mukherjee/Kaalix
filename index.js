import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';

// Resolve __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Resolve the path to the logo image in shared/assets/
const logoPath = path.join(__dirname,'Assets', 'LOGO.png');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 810,
    icon: logoPath, // 🖼️ Set icon for Linux/Windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL('http://localhost:4000/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'server.js');

  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true,
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Failed to start backend process:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`⚠️ Backend process exited with code ${code}`);
  });
}

function waitForBackend(url, tries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      http.get(url, () => resolve())
        .on('error', () => {
          if (++attempt < tries) return setTimeout(check, delay);
          reject(new Error('Backend did not respond in time'));
        });
    };
    check();
  });
}

app.whenReady().then(() => {
  startBackend();

  waitForBackend('http://localhost:4000/')
    .then(createWindow)
    .catch((err) => {
      console.error('❌ Backend failed to start:', err);
      app.quit();
    });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
