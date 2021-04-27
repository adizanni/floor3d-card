/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css,
  PropertyValues,
  internalProperty,
} from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types

import './editor';

import type { EntityFloor3dCardConfig, Floor3dCardConfig } from './types';
//import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import * as THREE from 'three';
import { Projector } from 'three/examples/jsm/renderers/Projector';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { Material } from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { NotEqualStencilFunc, Object3D } from 'three';



/* eslint no-console: 0 */
console.info(
  `%c  FLOOR3D-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'floor3d-card',
  name: 'Floor3d Card',
  description: 'A template custom card for you to create something awesome',
});

// TODO Name your custom element
@customElement('floor3d-card')
export class Floor3dCard extends LitElement {

  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _renderer?: THREE.WebGLRenderer;
  private _controls?: OrbitControls;
  private _modelX?: number;
  private _modelY?: number;
  private _modelZ?: number;

  private _states?: string[];
  private _color?: number[][];
  private _brightness?: number[];

  private _firstcall?: boolean;
  private _card: any;
  private _box: Element;


  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('floor3d-card-editor');
  }

  public static getStubConfig(): object {
    return {};
  }

  // TODO Add any properities that should cause your element to re-render here
  // https://lit-element.polymer-project.org/guide/properties
  //@property({ attribute: false }) public hass!: HomeAssistant;
  @internalProperty() private config!: Floor3dCardConfig;

  // https://lit-element.polymer-project.org/guide/properties#accessors-custom
  public setConfig(config: Floor3dCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this.config = {
      name: 'Floor 3d',
      ...config,
    };
    console.log('Start Load');
    //this._canvasdiv = document.createElement('div');
    this._firstcall = true;
    this.display3dmodel();
  }

  private _firstUpdated(): void {
    this._box = this.shadowRoot.getElementById('3d_canvas')
    this._box.appendChild(this._renderer.domElement)
    this._box.addEventListener("resize", this._resizeCanvas.bind(this));
    this._box.addEventListener("dblclick", this._showObjectName.bind(this) );
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.maxPolarAngle = 0.9 * Math.PI / 2;
    this._controls.addEventListener( 'change', this._render.bind(this) );
    this._scene.add(new THREE.HemisphereLight( 0xffffbb, 0x080820, 0.5 ));
    this._renderer.render(this._scene, this._camera);
    this._resizeCanvas();
    this._animate();
  }

  private _render(): void {
    this._resizeCanvas();
    this._renderer.render(this._scene, this._camera);
  }

  private _showObjectName(e: any): void {

    const mouse: THREE.Vector2 = new THREE.Vector2();
    mouse.x = ( e.offsetX / this._box.clientWidth ) * 2 - 1;
    mouse.y = - ( e.offsetY  / this._box.clientHeight ) * 2 + 1;
    const raycaster: THREE.Raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, this._camera );
    const intersects: THREE.Intersection[] = raycaster.intersectObjects( this._scene.children,true );
    if(intersects.length > 0 && intersects[0].object.name != ''){
      window.prompt("Object:",intersects[0].object.name);
    }
  }

  public set hass(hass: HomeAssistant) {

    if (this.config.entities) {
      if (this._firstcall) {
        this._states = [];
        this._color = [];
        this._brightness = [];
        this.config.entities.forEach((entity) => {
          this._states.push(hass.states[entity.entity].state);
          if (hass.states[entity.entity].attributes['rgb_color']) {
            this._color.push(hass.states[entity.entity].attributes['rgb_color']);
          } else {
            this._color.push([]);
          }
          if (hass.states[entity.entity].attributes['brightness']) {
            this._brightness.push(hass.states[entity.entity].attributes['brightness']);
          } else {
            this._brightness.push(0);
          }
        });
        this._firstcall = false;
      }
      else {
        this.config.entities.forEach((entity,i) => {
          if (entity.type3d =='light') {
            let toupdate = false;
            if ( this._states[i] !== hass.states[entity.entity].state ) {
              this._states[i] =  hass.states[entity.entity].state;
              toupdate = true;
            }
            if (hass.states[entity.entity].attributes['rgb_color']) {
                if (hass.states[entity.entity].attributes['rgb_color'] !== this._color[i]) {
                  toupdate = true;
                  this._color[i] = hass.states[entity.entity].attributes['rgb_color'];
                }
            }
            if (hass.states[entity.entity].attributes['brightness']) {
              if (hass.states[entity.entity].attributes['brightness'] !== this._brightness[i]) {
                toupdate = true;
                this._brightness[i] = hass.states[entity.entity].attributes['brightness'];
              }
            }
            if (toupdate) {
              this._updatelight(entity,this._states[i],this._color[i],this._brightness[i]);
            }
          }
          else if (this._states[i] !== hass.states[entity.entity].state) {
            this._states[i] =  hass.states[entity.entity].state;
            if (entity.type3d =='color') {
              this._updatecolor(entity,this._states[i]);
            } else if (entity.type3d =='hide') {
              this._updatehide(entity,this._states[i]);
            }
          }
        })
      }
    }

  }

  protected display3dmodel(): void {

    this._scene = new THREE.Scene();
    if (this.config.backgroundColor && this.config.backgroundColor != '#000000') {
      this._scene.background = new THREE.Color(this.config.backgroundColor);
    } else {
      this._scene.background = new THREE.Color(0x999999);
    }
    this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 99999999,);
    this._scene.add(this._camera);

    let hemiLight: THREE.HemisphereLight;

    if (this.config.globalLightPower) {
      hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, this.config.globalLightPower);
    } else {
      hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.3);
    }
    this._scene.add(hemiLight);
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.domElement.style.width = '100%';
    this._renderer.domElement.style.height = '100%';
    this._renderer.domElement.style.display = 'block';
    //this._canvasdiv.appendChild( this._renderer.domElement );

    if (this.config.mtlfile && this.config.mtlfile != '') {
      const mtlLoader: MTLLoader = new MTLLoader();
      mtlLoader.setPath(this.config.path);
      mtlLoader.load(this.config.mtlfile, this._onLoaded3DMaterials.bind(this), this._onLoadMaterialProgress.bind(this)
        , function (error: ErrorEvent) {
          throw new Error(error.error);
        });

    } else {
      const objLoader: OBJLoader = new OBJLoader();
      objLoader.load(this.config.path + this.config.objfile, this._onLoaded3DModel.bind(this), this._onLoadObjectProgress.bind(this) , function (error: ErrorEvent): void {
          throw new Error(error.error);
        });
    }


  }

  private _onLoadMaterialProgress (_progress: ProgressEvent): void {
    return
  }

  private _onLoadObjectProgress (_progress: ProgressEvent): void {
    return
  }

private _resizeCanvas(): void {
    // Display canvas
    const canvas: Element = this._renderer.domElement;
    this._camera.aspect = canvas.clientWidth/canvas.clientHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    this._renderer.render( this._scene, this._camera );
  }

private _onLoaded3DModel(object: THREE.Object3D): void {
  const bBox: THREE.Box3 = new THREE.Box3().setFromObject(object);
  this._camera.position.set(bBox.max.x*1.3,bBox.max.y*1.3,bBox.max.z*1.3);
  this._modelX = object.position.x = -(bBox.max.x - bBox.min.x) / 2;
  this._modelY = object.position.y = - bBox.min.y;
  this._modelZ = object.position.z = -(bBox.max.z - bBox.min.z) / 2;
  this._scene.add(object);
  this._camera.lookAt(object.position);
  this._add3dObjects();
  this._firstUpdated();
}

private _onLoaded3DMaterials(materials: MTLLoader.MaterialCreator): void {
  //materials. .lights = false;
  materials.preload();
  const objLoader: OBJLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  objLoader.load(this.config.path+this.config.objfile,this._onLoaded3DModel.bind(this),function(_progress: ProgressEvent) {
  return }, function(error: ErrorEvent): void {
    throw new Error(error.error);
  })
}

private _animate(): void {
  requestAnimationFrame(this._animate.bind(this));
  this._render();
  this._controls.update();
}

private _add3dObjects(): void {

  this.config.entities.forEach((entity, i) => {


    const _foundobject: any = this._scene.getObjectByName(entity.object_id)

    if (!_foundobject) {
      return;
    }

    if (entity.type3d == 'light') {

      const box: THREE.Box3 = new THREE.Box3();
      box.setFromObject(_foundobject);
      const light: THREE.PointLight = new THREE.PointLight(new THREE.Color('#ffffff'), 0, 300, 2);
      light.position.set((box.max.x - box.min.x) / 2 + box.min.x + this._modelX, (box.max.y - box.min.y) / 2 + box.min.y + this._modelY, (box.max.z - box.min.z) / 2 + box.min.z + this._modelZ);
      light.castShadow = true;
      light.name = entity.light_name;
      this._scene.add(light);
      this._updatelight(entity, this._states[i], this._color[i], this._brightness[i]);
    } else if (entity.type3d == 'color') {
        _foundobject.material = _foundobject.material.clone();
        this._updatecolor(entity, this._states[i]);
    } else if (entity.type3d == 'hide') {
      this._updatehide(entity, this._states[i]);
    }
  });

}

private _RGBToHex(r: number,g: number,b: number): string {

  let rs: string = r.toString(16);
  let gs: string = g.toString(16);
  let bs: string = b.toString(16);

  if (rs.length == 1)
    rs = "0" + rs;
  if (gs.length == 1)
    gs = "0" + gs;
  if (bs.length == 1)
    bs = "0" + bs;

  return "#" + rs + gs + bs;
}

private _updatelight(item: EntityFloor3dCardConfig,state: string,color: number[],brightness: number): void {

  const light: any = this._scene.getObjectByName(item.light_name);
  if (!light) {
    return
  }
  let max: number;

  if (item.lumens) {
    max = item.lumens;
  } else {
    max = 800;
  }

  if (state == 'on') {
    if (brightness) {
      light.intensity = 0.01 * max * brightness / 255;
    } else {
      light.intensity = 0.01 * max;
    }
    if (!color) {
      light.color = new THREE.Color('#ffffff');
    }
    else {
      light.color = new THREE.Color(this._RGBToHex(color[0], color[1], color[2]));
    }
  } else {
    light.intensity = 0;
      //light.color = new THREE.Color('#000000');
    }
  }

private _updatecolor(item: EntityFloor3dCardConfig,state: string): void {

  const _object: any = this._scene.getObjectByName(item.object_id);

  let i: any;

  for(i in item.conditions) {
    if (state == item.conditions[i].state ) {
      _object.material.color.set(item.conditions[i].color);
      return;
    }
  }
}


private _updatehide(item: EntityFloor3dCardConfig, state: string): void {

  const _object: any = this._scene.getObjectByName(item.object_id);

  if ( state == item.state ) {
    _object.visible = false;
  } else {
    _object.visible = true;
  }

}


  // https://lit-element.polymer-project.org/guide/lifecycle#shouldupdate
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    }

    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  // https://lit-element.polymer-project.org/guide/templates
  protected render(): TemplateResult | void {
    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this.config.show_warning) {
      return this._showWarning(localize('common.show_warning'));
    }

    if (this.config.show_error) {
      return this._showError(localize('common.show_error'));
    }

    return html`
      <ha-card
        .header=${this.config.name}
        tabindex="0"
        .label=${`Floor3d: ${this.config.entity || 'No Entity Defined'}`}
        .style=${`${this.config.style || 'width: auto; height: 100vh'}`}
        id="ha-card-1"
      >
      <div id="3d_canvas" height="100%"></div>
      </ha-card>
    `;
  }

  /*
  @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this.config.hold_action),
          hasDoubleClick: hasAction(this.config.double_tap_action),
        })}
        */

  private _handleAction(ev: ActionHandlerEvent): void {
    if (this.hass && this.config && ev.detail.action) {
      handleAction(this, this.hass, this.config, ev.detail.action);
    }
  }

  private _showWarning(warning: string): TemplateResult {
    return html`
      <hui-warning>${warning}</hui-warning>
    `;
  }

  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config,
    });

    return html`
      ${errorCard}
    `;
  }

  // https://lit-element.polymer-project.org/guide/styles
  static get styles(): CSSResult {
    return css``;
  }
}

