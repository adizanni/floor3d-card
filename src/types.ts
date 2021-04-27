import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'floor3d-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// TODO Add your configuration elements here for type-checking
export interface Floor3dCardConfig extends LovelaceCardConfig {
  type: string;
  path: string;
  name?: string;
  objfile: string;
  mtlfile?: string;
  style: string;
  backgroundColor?: string;
  globalLightPower?: number;
  entities?: EntityFloor3dCardConfig[];
  test_gui?: boolean;
  entity?: string;
  tap_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface EntityFloor3dCardConfig {
  entity: string;
  type3d: 'light' | 'color' | 'hide';
  object_id: string;
  light_name: string;
  lumens: number;
  conditions: ConditionsFloor3dCardConfig[];
  state: string;
}

export interface ConditionsFloor3dCardConfig {
  condition: string;
  state: string;
  color: string;
}