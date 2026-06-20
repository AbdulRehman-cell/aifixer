const { spawn } = require('child_process');
const path = require('path');

/**
 * Runs a command and captures stdout + stderr reliably.
 * This replaces ALL VS Code terminal watching.
 */
function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        output
      });
    });
  });
}

/**
 * Simple language → run command mapping
 */
function getRunCommand(filePath) {
  if (!filePath) return null;

  if (filePath.endsWith('.py')) return `python "${filePath}"`;
  if (filePath.endsWith('.js')) return `node "${filePath}"`;
  if (filePath.endsWith('.ts')) return `ts-node "${filePath}"`;
  if (filePath.endsWith('.java')) return `javac "${filePath}" && java "${filePath.replace('.java','')}"`;
  if (filePath.endsWith('.cpp')) return `g++ "${filePath}" -o temp && temp`;

  return null;
}

module.exports = {
  runCommand,
  getRunCommand
};