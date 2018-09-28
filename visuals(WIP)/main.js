var path = require('path');
const {app, BrowserWindow} = require('electron')
const magi = require('./magi.js');

let win

function createWindow () {
  win = new BrowserWindow({width: 800, height: 600})
  win.loadURL('index.html');


  magi.pass({'_': [], s:true, d:true});

  win.on('closed', () => {
    win = null
  })
}


app.on('ready', function() {
  createWindow();
})

app.on('window-all-closed', () => {
  magi.pass({'_': [], a: true});
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

