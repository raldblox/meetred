const { app, BrowserWindow } = require("electron");
const path =require("path");
const { spawn } = require("child_process");

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    const server = spawn(
      path.join(__dirname, "node_modules/.bin/next"),
      ["start"],
      {
        cwd: path.join(__dirname),
        env: {
          ...process.env,
          NODE_ENV: "production",
        },
      }
    );

    server.stdout.on("data", (data) => {
      console.log(`server: ${data}`);
      if (data.toString().includes("started server on")) {
        win.loadURL("http://localhost:3000");
      }
    });

    server.stderr.on("data", (data) => {
      console.error(`server error: ${data}`);
    });
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
