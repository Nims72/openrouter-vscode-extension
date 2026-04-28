import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface OpenRouterSettings {
  apiKey: string;
  serverPath: string;
  port: number;
  model: string;
  modelOpus: string;
  modelSonnet: string;
  modelHaiku: string;
  autoStartServer: boolean;
}

function parseDotEnv(envPath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { continue; }
      const eq = trimmed.indexOf('=');
      if (eq === -1) { continue; }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

const ENV_SETTING_MAP: Array<{ setting: string; envKey: string }> = [
  { setting: 'apiKey',       envKey: 'OPENROUTER_API_KEY' },
  { setting: 'model',        envKey: 'MODEL'              },
  { setting: 'modelOpus',    envKey: 'MODEL_OPUS'         },
  { setting: 'modelSonnet',  envKey: 'MODEL_SONNET'       },
  { setting: 'modelHaiku',   envKey: 'MODEL_HAIKU'        },
];

// Writes .env values into VS Code Global settings for any field currently left empty.
// This makes the values visible in the Settings UI while still allowing user overrides.
export async function syncDotEnvToSettings(extensionPath: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('openrouter');
  const configuredPath = cfg.get<string>('serverPath', '');
  const serverPath = configuredPath || path.join(extensionPath, 'server');
  const dotEnv = parseDotEnv(path.join(serverPath, '.env'));

  for (const { setting, envKey } of ENV_SETTING_MAP) {
    const current = cfg.get<string>(setting, '');
    const envValue = dotEnv[envKey];
    if (!current && envValue) {
      await cfg.update(setting, envValue, vscode.ConfigurationTarget.Global);
    }
  }
}

export function getSettings(extensionPath: string): OpenRouterSettings {
  const cfg = vscode.workspace.getConfiguration('openrouter');
  const configuredPath = cfg.get<string>('serverPath', '');
  const serverPath = configuredPath || path.join(extensionPath, 'server');

  // Fall back to server/.env for values not explicitly set in VS Code settings
  const dotEnv = parseDotEnv(path.join(serverPath, '.env'));

  return {
    apiKey:          cfg.get<string>('apiKey', '')          || dotEnv['OPENROUTER_API_KEY'] || '',
    serverPath,
    port:            cfg.get<number>('port', 8082),
    model:           cfg.get<string>('model', '')           || dotEnv['MODEL']              || '',
    modelOpus:       cfg.get<string>('modelOpus', '')       || dotEnv['MODEL_OPUS']         || '',
    modelSonnet:     cfg.get<string>('modelSonnet', '')     || dotEnv['MODEL_SONNET']       || '',
    modelHaiku:      cfg.get<string>('modelHaiku', '')      || dotEnv['MODEL_HAIKU']        || '',
    autoStartServer: cfg.get<boolean>('autoStartServer', true),
  };
}
