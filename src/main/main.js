/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import log from 'electron-log';
import { resolveHtmlPath } from './util';

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Tray,
  Menu,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import child_process from 'child_process';
import got from 'got';
import glob from 'glob';
import Store from 'electron-store';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let tray;

  const store = new Store();

  class AppUpdater {
    constructor() {
      log.transports.file.level = 'info';
      autoUpdater.logger = log;
      autoUpdater.checkForUpdatesAndNotify();
    }
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths) => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  let mainWindow = null;

  ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply('ipc-example', msgTemplate('pong'));
  });

  if (process.env.NODE_ENV === 'production') {
    const sourceMapSupport = require('source-map-support');
    sourceMapSupport.install();
  }

  const isDebug =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

  if (isDebug) {
    require('electron-debug')();
  }

  const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ['REACT_DEVELOPER_TOOLS'];

    return installer
      .default(
        extensions.map((name) => installer[name]),
        forceDownload
      )
      .catch(console.log);
  };

  const createWindow = async () => {
    if (isDebug) {
      await installExtensions();
    }

    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      show: false,
      roundedCorners: false,
      frame: false,
      icon: getAssetPath('icon.png'),
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
    });

    const filter = {
      urls: ['https://file-service-worker.worlds-embrace.workers.dev/*'],
    };

    mainWindow.webContents.session.webRequest.onHeadersReceived(
      filter,
      (details, callback) => {
        details.responseHeaders['access-control-allow-origin'] = ['*'];
        callback({ responseHeaders: details.responseHeaders });
      }
    );

    mainWindow.loadURL(resolveHtmlPath('index.html'));

    mainWindow.on('ready-to-show', () => {
      if (!mainWindow) {
        throw new Error('"mainWindow" is not defined');
      }
      mainWindow.show();

      mainWindow.webContents.send('app_version', app.getVersion());
    });

    mainWindow.on('closed', function () {
      mainWindow = null;
    });

    mainWindow.on('close', function (event) {
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
        event.returnValue = false;
      } 
    });

    // Open urls in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);
      return { action: 'deny' };
    });

    // Remove this if your app does not use auto updates
    // eslint-disable-next-line
    new AppUpdater();
  };

  /**
   * Add event listeners...
   */

  app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app
    .whenReady()
    .then(() => {
      tray = new Tray(getAssetPath('icon.png'));

      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: 'Open',
            click: function () {
              mainWindow.show();
            },
          },
          {
            label: 'Quit',
            click: function () {
              app.isQuiting = true;
              app.quit();
            },
          },
        ])
      );

      createWindow();
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);

  ipcMain.on('minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('close', () => {
    app.quit();
  });

  ipcMain.on('restart_app', () => {
    app.isQuiting = true;

    autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle(
    'diff:build',
    async (context, { folder, gameName, fromVersion, toVersion }) => {
      const fs = require('fs');
      const { spawn } = require('child_process');

      fs.mkdirSync('temp', { recursive: true });

      const args = [
        '-D',
        '-f',
        `.\\Games\\${gameName}`,
        `${folder}`,
        `.\\temp\\PATCH_${fromVersion
          .replace('.', '_')
          .replace('.', '_')}_TO_${toVersion
          .replace('.', '_')
          .replace('.', '_')}.bin`,
      ];

      return await new Promise((resolve, reject) => {
        const ls = spawn(getResourcePath('hdiffz'), args, {
          detached: true,
          windowsHide: true,
        });

        ls.stdout.on('data', (data) => {
          data = data.toString();

          console.log(data);
        });

        ls.stderr.on('data', (data) => {
          console.log(`stderr: ${data.toString()}`);
        });

        ls.on('error', (error) => {
          reject(error);
        });

        ls.on('close', (code) => {
          resolve();
        });
      });
    }
  );

  ipcMain.handle(
    'upgrade:build',
    async (context, { gameName, fromVersion, toVersion }) => {
      const fs = require('fs');
      const { spawn } = require('child_process');

      const args = [
        '--patch',
        '-f',
        `.\\Games\\${gameName}`,
        `.\\temp\\PATCH_${fromVersion
          .replace('.', '_')
          .replace('.', '_')}_TO_${toVersion
          .replace('.', '_')
          .replace('.', '_')}.bin`,
        `.\\Games\\${gameName}`,
      ];

      return await new Promise((resolve, reject) => {
        const ls = spawn(getResourcePath('hdiffz'), args, {
          detached: true,
          windowsHide: true,
        });

        ls.stdout.on('data', (data) => {
          data = data.toString();

          console.log(data);
        });

        ls.stderr.on('data', (data) => {
          console.log(`stderr: ${data.toString()}`);
        });

        ls.on('error', (error) => {
          reject(error);
        });

        ls.on('close', (code) => {
          resolve();
        });
      });
    }
  );

  ipcMain.handle('hash:build', async (context, { folder }) => {
    const fs = require('fs');
    const { spawn } = require('child_process');

    return await new Promise((resolve, reject) => {
      const ls = spawn(
        getResourcePath('7za.exe'),
        ['h', '-scrcsha256', '-ba', '-bsp1', `${folder}\\`],
        { detached: true, windowsHide: true }
      );

      const hashes = {};

      ls.stdout.on('data', (data) => {
        data = data.toString();

        let split = data
          .split('\r')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);

        for (let item of split) {
          let match = item.match(
            /\b(?<!\.)(?!0+(?:\.0+)?%)(?:\d|[1-9]\d|100)(?:(?<!100)\.\d+)?%/
          );

          if (match && match.length > 0) {
            mainWindow.webContents.send(
              '__progress',
              match[0].replace('%', '')
            );
          } else {
            match = item.match(/^[A-Fa-f0-9]{64}/);

            if (match) {
              function indexOfFirstDigit(input, start) {
                let i = start;
                for (; input[i] < '0' || input[i] > '9'; i++);
                return i == input.length ? -1 : i;
              }

              function indexOfFirsNontDigit(input, start) {
                let i = start;
                for (; !(input[i] < '0' || input[i] > '9'); i++);
                return i == input.length ? -1 : i;
              }

              let indexOfPath = indexOfFirsNontDigit(
                item,
                indexOfFirstDigit(item, 65)
              );

              let path = item.substring(indexOfPath).trim();

              path = path.substring(path.indexOf('\\') + 1);

              let hash = match[0];

              hashes[path] = hash;
            }
          }
        }
      });

      ls.stderr.on('data', (data) => {
        console.log(`stderr: ${data.toString()}`);
      });

      ls.on('error', (error) => {
        reject(error);
      });

      ls.on('close', (code) => {
        resolve(hashes);
      });
    });
  });

  ipcMain.handle('compress:build', async (context, { version, folder }) => {
    const fs = require('fs');
    const { spawn } = require('child_process');

    fs.mkdirSync('temp', { recursive: true });

    return await new Promise((resolve, reject) => {
      const ls = spawn(
        getResourcePath('7za.exe'),
        [
          'a',
          '-bsp1',
          '-v500m',
          `temp/Game_${version.replace('.', '_').replace('.', '_')}.7z`,
          `${folder}\\*`,
        ],
        { detached: true, windowsHide: true }
      );

      ls.stdout.on('data', (data) => {
        let match = data
          .toString()
          .match(
            /\b(?<!\.)(?!0+(?:\.0+)?%)(?:\d|[1-9]\d|100)(?:(?<!100)\.\d+)?%/
          );

        if (match && match.length > 0) {
          mainWindow.webContents.send('__progress', match[0].replace('%', ''));
        }
      });

      ls.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });

      ls.on('error', (error) => {
        reject(error);
      });

      ls.on('close', (code) => {
        glob(
          `temp/Game_${version.replace('.', '_').replace('.', '_')}.7z.*`,
          function (err, files) {
            if (err) {
              reject('err');
            }

            resolve(files);
          }
        );
      });
    });
  });

  ipcMain.handle('upload:build', async (context, { filename, gameName }) => {
    var fs = require('fs');

    const result = await got
      .put(
        `https://file-service-worker.worlds-embrace.workers.dev/${gameName}/${path.basename(
          filename
        )}`
      )
      .json();

    const { method, url, headers } = result;

    await got
      .put(url, {
        headers,
        body: fs.createReadStream(filename),
      })
      .on('uploadProgress', (progress) => {
        mainWindow.webContents.send('__progress', progress.percent * 100);
      });
  });

  ipcMain.handle(
    'upload:manifest',
    async (context, { files, version, gameName, executable, hashes, from }) => {
      var FormData = require('form-data');
      var fs = require('fs');

      let result = await got
        .put(
          `https://file-service-worker.worlds-embrace.workers.dev/${gameName}/manifest.json`
        )
        .json();

      await got
        .put(result.url, {
          headers: result.headers,
          body: JSON.stringify({
            gameName,
            files: files.map((file) => path.basename(file)),
            version,
            executable,
            sha256: hashes,
            from,
          }),
        })
        .on('uploadProgress', (progress) => {
          mainWindow.webContents.send('__progress', progress.percent * 100);
        });
    }
  );

  ipcMain.handle('file:exists', async (context, { path }) => {
    var fs = require('fs');

    return fs.promises
      .access(path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  });

  ipcMain.handle('clean:build', async (context, { version }) => {
    var fs = require('fs');

    try {
      fs.rmSync('temp', { recursive: true, force: true });
    } catch (ex) {
      console.log(ex);
    }
  });

  ipcMain.handle('copy:build', async (context, { folder, gameName }) => {
    var fs = require('fs');

    fs.mkdirSync('Games', { recursive: true });

    function move(oldPath, newPath) {
      return new Promise((resolve) => {
        fs.rename(oldPath, newPath, function (err) {
          if (err) {
            if (err.code === 'EXDEV') {
              copy();
            } else {
              resolve(err);
            }
            return;
          }
          resolve();
        });

        function copy() {
          var readStream = fs.createReadStream(oldPath);
          var writeStream = fs.createWriteStream(newPath);

          readStream.on('error', resolve);
          writeStream.on('error', resolve);

          readStream.on('close', function () {
            fs.unlink(oldPath, resolve);
          });

          readStream.pipe(writeStream);
        }
      });
    }

    fs.rmSync(`./Games/${gameName}`, {
      recursive: true,
      force: true,
    });

    await move(folder, `./Games/${gameName}`);
  });

  ipcMain.handle('download:build', (context, { filename, gameName }) => {
    return new Promise((resolve, reject) => {
      var fs = require('fs');

      fs.mkdirSync('temp', { recursive: true });

      const downloadStream = got.stream(
        `https://file-service-worker.worlds-embrace.workers.dev/${gameName}/${path.basename(
          filename
        )}`
      );

      const fileWriterStream = fs.createWriteStream(
        path.join('temp', path.basename(filename))
      );

      downloadStream.on('downloadProgress', (progress) => {
        mainWindow.webContents.send('__progress', progress.percent * 100);
      });

      fileWriterStream
        .on('error', (error) => {
          reject(error);
        })
        .on('finish', () => {
          resolve();
        });

      downloadStream.pipe(fileWriterStream);
    });
  });

  ipcMain.handle('remove:build', async (context, { gameName }) => {
    const fs = require('fs');

    fs.rmSync(path.join('Games', gameName), {
      recursive: true,
      force: true,
    });
  });

  ipcMain.handle('install:build', async (context, { gameName, version }) => {
    const fs = require('fs');
    const { spawn } = require('child_process');

    fs.mkdirSync('Games', { recursive: true });

    return new Promise((resolve, reject) => {
      fs.rmSync(`Games/${gameName}`, { recursive: true, force: true });

      const ls = spawn(
        getResourcePath('7za.exe'),
        [
          'x',
          '-bsp1',
          `temp/Game_${version.replace('.', '_').replace('.', '_')}.7z.001`,
          `-oGames/${gameName}`,
        ],
        { detached: true, windowsHide: true }
      );

      ls.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);

        let match = data
          .toString()
          .match(
            /\b(?<!\.)(?!0+(?:\.0+)?%)(?:\d|[1-9]\d|100)(?:(?<!100)\.\d+)?%/
          );

        if (match && match.length > 0) {
          mainWindow.webContents.send('__progress', match[0].replace('%', ''));
        }
      });

      ls.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });

      ls.on('error', (error) => {
        reject(error);
      });

      ls.on('close', (code) => {
        resolve();
      });
    });
  });

  ipcMain.handle(
    'play',
    async (context, { gameName, executable, accessToken, refreshToken }) => {
      const fs = require('fs');
      const { spawn } = require('child_process');

      return new Promise((resolve, reject) => {
        const ls = spawn(
          path.join('Games', gameName, executable),
          [accessToken, refreshToken],
          {
            detached: true,
          }
        );

        resolve();

        app.quit();
      });
    }
  );

  ipcMain.handle('store:set', async (context, { key, value }) => {
    store.set(key, value);
  });

  ipcMain.handle('store:get', async (context, { key }) => {
    return store.get(key) || {};
  });

  ipcMain.handle('store:merge', async (context, { key, value }) => {
    let result = { ...(store.get(key) || {}), ...value };

    store.set(key, result);

    return result || {};
  });
}
