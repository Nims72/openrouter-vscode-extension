import * as vscode from 'vscode';
import { OpenRouterSettings } from './settingsProvider';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

function shortName(model: string): string {
  if (!model) { return ''; }
  const parts = model.split('/');
  return parts[parts.length - 1];
}

function buildTooltip(enabled: boolean, status: ServerStatus, settings?: OpenRouterSettings): string {
  if (!enabled || !settings) { return 'Click to enable OpenRouter proxy'; }

  const lines = ['Click to disable OpenRouter proxy', ''];
  if (settings.modelOpus)   { lines.push(`Opus:   ${settings.modelOpus}`); }
  if (settings.modelSonnet) { lines.push(`Sonnet: ${settings.modelSonnet}`); }
  if (settings.modelHaiku)  { lines.push(`Haiku:  ${settings.modelHaiku}`); }
  if (settings.model)       { lines.push(`Fallback: ${settings.model}`); }
  lines.push('', `Port: ${settings.port}`);

  if (status === 'error') { lines.push('', '⚠ Server failed to start'); }

  return lines.join('\n');
}

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'openrouter.toggle';
    this.item.tooltip = 'Click to enable OpenRouter proxy';
    this.item.show();
  }

  update(enabled: boolean, status: ServerStatus, settings?: OpenRouterSettings, activeModel?: string, activeTier?: string): void {
    this.item.tooltip = buildTooltip(enabled, status, settings);

    if (!enabled) {
      this.item.text            = '$(circle-slash) OpenRouter';
      this.item.backgroundColor = undefined;
      this.item.color           = undefined;
      return;
    }

    // Only show model info after the first proxy request has been made
    const displayModel = activeModel ? shortName(activeModel) : '';
    const tierLabel  = activeTier ? `${activeTier.charAt(0).toUpperCase() + activeTier.slice(1)} · ` : '';
    const modelSuffix = displayModel ? ` ${tierLabel}${displayModel}` : '';

    switch (status) {
      case 'starting':
        this.item.text            = '$(sync~spin) OpenRouter';
        this.item.backgroundColor = undefined;
        this.item.color           = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;
      case 'running':
        this.item.text            = `$(check) OpenRouter${modelSuffix}`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.item.color           = undefined;
        break;
      case 'error':
        this.item.text            = '$(error) OpenRouter';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.color           = undefined;
        break;
      default:
        this.item.text            = '$(circle-slash) OpenRouter';
        this.item.backgroundColor = undefined;
        this.item.color           = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
