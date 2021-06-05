/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionConfig, LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'floor3d-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// TODO Add your configuration elements here for type-checking
export interface Floor3dCardConfig {
  type: string;
  path: string;
  name: string;
  font: string;
  objfile: string;
  mtlfile: string;
  style: string;
  backgroundColor: string;
  globalLightPower: number;
  entities: any;
  tap_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  entity: string;
  type3d: string;
  object_id: string;
  lumens: number;
  colorcondition: any;
  light: any;
  text: any;
  textbgcolor: string;
  textfgcolor: string;
  hide: any;
  state: string;
  target: any;
  color: string;
  show_warning: boolean;
  show_error: boolean;
}

export interface EntityFloor3dCardConfig {
  hide: any;
  entity: string;
  type3d: 'light' | 'color' | 'hide' | 'text';
  object_id: string;
  lumens: number;
  conditions: ConditionsFloor3dCardConfig[];
  state: string;
}

export interface ConditionsFloor3dCardConfig {
  condition: string;
  state: string;
  color: string;
}
