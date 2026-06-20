const vscode = require('vscode');

let channel;

function getChannel() {
  if (!channel) {
    channel = vscode.window.createOutputChannel('AI Error Fixer');
  }
  return channel;
}

function log(message) {
  const ts = new Date().toLocaleTimeString();
  getChannel().appendLine(`[${ts}] ${message}`);
}

module.exports = { log, getChannel };
