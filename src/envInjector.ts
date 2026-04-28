import * as vscode from 'vscode';
import { OpenRouterSettings } from './settingsProvider';

export class EnvInjector {
  private readonly collection: vscode.EnvironmentVariableCollection;

  constructor(context: vscode.ExtensionContext) {
    this.collection = context.environmentVariableCollection;
    this.collection.description = 'OpenRouter proxy environment variables';
  }

  apply(settings: OpenRouterSettings): void {
    this.collection.clear();

    this.collection.replace('ANTHROPIC_BASE_URL',   `http://localhost:${settings.port}`);
    this.collection.replace('ANTHROPIC_AUTH_TOKEN', 'freecc');
    this.collection.replace('OPENROUTER_API_KEY',   settings.apiKey);

    if (settings.model)       { this.collection.replace('MODEL',        settings.model); }
    if (settings.modelOpus)   { this.collection.replace('MODEL_OPUS',   settings.modelOpus); }
    if (settings.modelSonnet) { this.collection.replace('MODEL_SONNET', settings.modelSonnet); }
    if (settings.modelHaiku)  { this.collection.replace('MODEL_HAIKU',  settings.modelHaiku); }
  }

  clear(): void {
    this.collection.clear();
  }
}
