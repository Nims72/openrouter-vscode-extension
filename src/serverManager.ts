import * as cp from 'child_process';
import * as vscode from 'vscode';
import { OpenRouterSettings } from './settingsProvider';
import { ServerStatus } from './statusBar';

type StatusChangeCallback = (status: ServerStatus) => void;

export class ServerManager {
  private process: cp.ChildProcess | null = null;
  private _status: ServerStatus = 'stopped';
  private readonly outputChannel: vscode.OutputChannel;
  private readonly onStatusChange: StatusChangeCallback;

  constructor(outputChannel: vscode.OutputChannel, onStatusChange: StatusChangeCallback) {
    this.outputChannel = outputChannel;
    this.onStatusChange = onStatusChange;
  }

  get status(): ServerStatus {
    return this._status;
  }

  private setStatus(s: ServerStatus): void {
    this._status = s;
    this.onStatusChange(s);
  }

  start(settings: OpenRouterSettings): void {
    if (this.process !== null) {
      this.outputChannel.appendLine('[ServerManager] Server is already running.');
      return;
    }

    this.setStatus('starting');
    this.killPortIfBusy(settings.port).then(() => this.spawnServer(settings));
  }

  private spawnServer(settings: OpenRouterSettings): void {
    this.outputChannel.appendLine(
      `[ServerManager] Starting uvicorn on port ${settings.port} in ${settings.serverPath}`
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_BASE_URL:   `http://localhost:${settings.port}`,
      ANTHROPIC_AUTH_TOKEN: 'freecc',
      OPENROUTER_API_KEY:   settings.apiKey,
      ...(settings.model       ? { MODEL:        settings.model }       : {}),
      ...(settings.modelOpus   ? { MODEL_OPUS:   settings.modelOpus }   : {}),
      ...(settings.modelSonnet ? { MODEL_SONNET: settings.modelSonnet } : {}),
      ...(settings.modelHaiku  ? { MODEL_HAIKU:  settings.modelHaiku }  : {}),
    };

    this.process = cp.spawn(
      'uv',
      ['run', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', String(settings.port)],
      {
        cwd:         settings.serverPath,
        env,
        shell:       true,
        windowsHide: true,
      }
    );

    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trimEnd();
      this.outputChannel.appendLine(text);
      if (text.includes('Application startup complete') || text.includes('Uvicorn running on')) {
        this.setStatus('running');
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trimEnd();
      this.outputChannel.appendLine(`[stderr] ${text}`);
      if (text.includes('Application startup complete') || text.includes('Uvicorn running on')) {
        this.setStatus('running');
      }
    });

    this.process.on('error', (err: Error) => {
      this.outputChannel.appendLine(`[ServerManager] Spawn error: ${err.message}`);
      this.process = null;
      this.setStatus('error');
      vscode.window.showErrorMessage(`OpenRouter: Failed to start server — ${err.message}`);
    });

    this.process.on('exit', (code: number | null, signal: string | null) => {
      this.outputChannel.appendLine(
        `[ServerManager] Process exited. code=${code}, signal=${signal}`
      );
      this.process = null;
      if (signal === null && code !== 0 && code !== null) {
        this.setStatus('error');
      } else {
        this.setStatus('stopped');
      }
    });
  }

  private killPortIfBusy(port: number): Promise<void> {
    if (process.platform !== 'win32') { return Promise.resolve(); }
    return new Promise((resolve) => {
      cp.exec(`netstat -ano | findstr ":${port} "`, (_err, stdout) => {
        const match = stdout?.match(/LISTENING\s+(\d+)/);
        if (!match) { resolve(); return; }
        const pid = match[1];
        this.outputChannel.appendLine(`[ServerManager] Port ${port} in use by PID ${pid} — killing.`);
        cp.exec(`taskkill /F /T /PID ${pid}`, () => setTimeout(resolve, 500));
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.process === null) {
        this.setStatus('stopped');
        resolve();
        return;
      }

      const proc = this.process;
      this.process = null;

      const timeout = setTimeout(() => {
        this.outputChannel.appendLine('[ServerManager] Kill timeout — force-killing tree.');
        this.killTree(proc);
        resolve();
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        this.setStatus('stopped');
        resolve();
      });

      this.killTree(proc);
    });
  }

  private killTree(proc: cp.ChildProcess): void {
    if (process.platform === 'win32' && proc.pid) {
      // Kill the entire process tree so uvicorn children don't outlive the shell
      cp.spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { shell: true });
    } else {
      proc.kill();
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
