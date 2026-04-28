import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { StatusBarManager, ServerStatus } from './statusBar';
import { EnvInjector } from './envInjector';
import { getSettings, syncDotEnvToSettings } from './settingsProvider';

const STATE_KEY = 'openrouter.enabled';

let serverManagerInstance: ServerManager | undefined;
let activeModel: string | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('OpenRouter Server');

  // Populate empty settings fields from server/.env so they appear in the Settings UI
  syncDotEnvToSettings(context.extensionPath).catch(() => {});
  context.subscriptions.push(outputChannel);

  const statusBar   = new StatusBarManager();
  const envInjector = new EnvInjector(context);

  serverManagerInstance = new ServerManager(
    outputChannel,
    (newStatus: ServerStatus) => {
      const isEnabled = context.globalState.get<boolean>(STATE_KEY, false);
      const settings  = getSettings(context.extensionPath);
      statusBar.update(isEnabled, newStatus, settings);
    }
  );

  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // Restore persisted toggle state
  const wasEnabled = context.globalState.get<boolean>(STATE_KEY, false);
  if (wasEnabled) {
    const settings = getSettings(context.extensionPath);
    outputChannel.appendLine(`[Extension] extensionPath: ${context.extensionPath}`);
    outputChannel.appendLine(`[Extension] serverPath: ${settings.serverPath}`);
    outputChannel.appendLine(`[Extension] apiKey resolved: ${settings.apiKey ? `yes (${settings.apiKey.length} chars)` : 'empty'}`);
    envInjector.apply(settings);
    if (settings.autoStartServer) {
      serverManagerInstance.start(settings);
    }
    statusBar.update(true, serverManagerInstance.status, settings);
  } else {
    statusBar.update(false, 'stopped');
  }

  // Watch server/.active_model.json for real-time model updates
  const activeModelFile = path.join(context.extensionPath, 'server', '.active_model.json');
  let modelWatcher: fs.FSWatcher | undefined;

  function startModelWatcher(): void {
    try {
      modelWatcher = fs.watch(path.dirname(activeModelFile), (_event, filename) => {
        if (filename !== '.active_model.json') { return; }
        try {
          const raw = fs.readFileSync(activeModelFile, 'utf8');
          const data = JSON.parse(raw) as { model: string; tier: string };
          activeModel = data.model;
          const isEnabled = context.globalState.get<boolean>(STATE_KEY, false);
          if (isEnabled) {
            statusBar.update(true, serverManagerInstance?.status ?? 'running', getSettings(context.extensionPath), activeModel);
          }
        } catch { /* file not ready yet */ }
      });
    } catch { /* server dir may not exist yet */ }
  }

  function stopModelWatcher(): void {
    modelWatcher?.close();
    modelWatcher = undefined;
    activeModel  = undefined;
  }

  context.subscriptions.push({ dispose: () => stopModelWatcher() });

  if (context.globalState.get<boolean>(STATE_KEY, false)) {
    startModelWatcher();
  }

  const toggleCommand = vscode.commands.registerCommand('openrouter.toggle', async () => {
    const current = context.globalState.get<boolean>(STATE_KEY, false);
    const next    = !current;

    await context.globalState.update(STATE_KEY, next);

    if (next) {
      const settings = getSettings(context.extensionPath);
      envInjector.apply(settings);
      statusBar.update(true, 'starting', settings);
      startModelWatcher();
      if (settings.autoStartServer) {
        serverManagerInstance!.start(settings);
      } else {
        statusBar.update(true, 'running', settings);
      }
    } else {
      stopModelWatcher();
      statusBar.update(false, 'stopped');
      envInjector.clear();
      await serverManagerInstance!.stop();
    }
  });

  context.subscriptions.push(toggleCommand);

  // Re-apply env vars and refresh status bar when settings change
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration('openrouter')) { return; }

    const isEnabled = context.globalState.get<boolean>(STATE_KEY, false);
    if (!isEnabled) { return; }

    const settings = getSettings(context.extensionPath);
    envInjector.apply(settings);
    statusBar.update(true, serverManagerInstance?.status ?? 'stopped', settings);
    outputChannel.appendLine('[Extension] Settings changed — env vars re-applied to new terminals.');
  });

  context.subscriptions.push(configWatcher);
}

export async function deactivate(): Promise<void> {
  if (serverManagerInstance) {
    await serverManagerInstance.stop();
  }
}
