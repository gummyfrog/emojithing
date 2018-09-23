
const {app, BrowserWindow} = require('electron')
const magi = require('./magi.js');

// const ipc = require('node-ipc');

// ipc.config.id = 'main';
// ipc.config.retry = 1500;

// ipc.connectTo('MAGI', function() {
//   ipc.of.MAGI.on('connect', function(){
//     console.log('main: connected to MAGI');
//     ipc.of.MAGI.emit('message', 'hello');
//     console.log('main: sent a message');
//   })
//   ipc.of.MAGI.on('disconnect', function() {
//     console.log('main: disconnected from MAGI');
//   })
//   ipc.of.MAGI.on('message', function(data) {
//     console.log('main: got a message from MAGI')
//   })
// })


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Open the DevTools.
  // win.webContents.openDevTools()
  magi.pass({'_': [], s: true, d:true});

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
  createWindow();

})




// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  magi.pass({'_': [], a: true});
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

