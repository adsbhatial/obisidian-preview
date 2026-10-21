import { defineConfig } from '@vscode/test-cli';

// Runs the Mocha tests in a real VS Code window that has test/workspace open, so the
// extension sees an actual workspace with notes, images and a PDF.
//
// By default @vscode/test-cli downloads a VS Code build into .vscode-test/. To use an
// installed VS Code instead, set VSCODE_EXECUTABLE_PATH to its Code.exe / code path.
const installed = process.env.VSCODE_EXECUTABLE_PATH;

export default defineConfig({
   files: 'test/suite/**/*.test.js',
   workspaceFolder: './test/workspace',
   ...(installed ? { useInstallation: { fromPath: installed } } : {}),
   launchArgs: ['--disable-extensions'],
   mocha: { ui: 'tdd', timeout: 20000 },
});
