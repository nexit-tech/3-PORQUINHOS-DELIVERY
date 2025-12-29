// electron-log.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const logPath = path.join(app.getPath('userData'), 'app.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage);
  
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error('Erro ao escrever log:', err);
  }
}

module.exports = { log, logPath };