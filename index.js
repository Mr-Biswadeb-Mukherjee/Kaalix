import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 👇 Load raw HTML directly from filesystem (no server, no build)
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');

  console.log('🧪 Trying to load:', indexPath);

  mainWindow.loadFile(indexPath);

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ index.html loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error(`❌ Failed to load index.html: [${code}] ${desc}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
