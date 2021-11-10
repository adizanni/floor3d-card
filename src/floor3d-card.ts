/* eslint-disable @typescript-eslint/ban-types */
import { LitElement, html, TemplateResult, css, PropertyValues, CSSResultGroup } from 'lit';
import { render } from 'lit';
import { property, customElement, state } from 'lit/decorators';
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
import { mergeDeep, hasConfigOrEntitiesChanged, createConfigArray, createObjectGroupConfigArray } from './helpers';
import type { Floor3dCardConfig, EntityFloor3dCardConfig } from './types';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
//import three.js libraries for 3D rendering
import * as THREE from 'three';
import { Projector } from 'three/examples/jsm/renderers/Projector';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { BooleanKeyframeTrack, Box3, DirectionalLightHelper, Group, LessEqualStencilFunc, Material, Mesh, Vector3 } from 'three';
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
  description: 'A custom card to visualize and activate entities in a live 3D model',
});

// TODO Name your custom element
@customElement('floor3d-card')
export class Floor3dCard extends LitElement {
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _renderer?: THREE.WebGLRenderer;
  private _controls?: OrbitControls;
  private _hemiLight?: THREE.HemisphereLight;
  private _modelX?: number;
  private _modelY?: number;
  private _modelZ?: number;
  private _to_animate: boolean;
  private _bboxmodel: THREE.Object3D;

  private _states?: string[];
  private _color?: number[][];
  private _initialmaterial?: THREE.Material[][];
  private _clonedmaterial?: THREE.Material[][];
  private _brightness?: number[];
  private _lights?: string[];
  private _canvas?: HTMLCanvasElement[];
  private _unit_of_measurement?: string[];
  private _text?: string[];
  private _objposition: number[][];
  private _slidingdoorposition: THREE.Vector3[][];
  private _objects_to_rotate: THREE.Group[];
  private _pivot: THREE.Vector3[];
  private _degrees: number[];
  private _axis_for_door: THREE.Vector3[];
  private _axis_to_rotate: string[];
  private _round_per_seconds: number[];
  private _rotation_state: number[];
  private _rotation_index: number[];
  private _clock?: THREE.Clock;
  private _slidingdoor: THREE.Group[];


  private _eval: Function;
  private _firstcall?: boolean;
  private _resizeTimeout?: number;
  private _resizeObserver: ResizeObserver;
  private _zIndexInterval: number;
  private _performActionListener: EventListener;
  private _changeListener: EventListener;
  private _cardObscured: boolean;
  private _card?: HTMLElement;
  private _content?: HTMLElement;
  private _progress?: HTMLElement;

  private _config!: Floor3dCardConfig;
  private _configArray: Floor3dCardConfig[] = [];
  private _object_ids?: Floor3dCardConfig[] = [];

  private _hass?: HomeAssistant;
  private _haShadowRoot: any;
  private _card_id: string;
  private _ambient_light: THREE.AmbientLight;
  private _direction_light: THREE.DirectionalLight;
  private _point_light: THREE.PointLight;
  _helper: THREE.DirectionalLightHelper;
  _modelready: boolean;
  private _maxtextureimage: number;

  constructor() {
    super();

    this._cardObscured = false;
    this._resizeObserver = new ResizeObserver(() => { this._resizeCanvasDebounce() });
    this._performActionListener = (evt) => this._performAction(evt);
    this._changeListener = () => this._render();
    this._haShadowRoot = document.querySelector('home-assistant').shadowRoot;
    this._eval = eval;
    this._card_id = 'ha-card-1';

    console.log('New Card');
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (this._modelready) {
      if (this._ispanel() || this._issidebar()) {
        this._resizeObserver.observe(this._card);
      }
      this._zIndexInterval = window.setInterval(() => {
        this._zIndexChecker();
      }, 250);

      if (this._to_animate) {
        this._clock = new THREE.Clock();
        this._renderer.setAnimationLoop(() => this._rotateobjects());
      }

      if (this._ispanel() || this._issidebar()) {
        this._resizeCanvas();
      }
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();

    this._resizeObserver.disconnect();
    window.clearInterval(this._zIndexInterval);

    if (this._modelready) {
      if (this._to_animate) {
        this._clock = null;
        this._renderer.setAnimationLoop(null);
      }
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('floor3d-card-editor');
  }

  public static getStubConfig(): object {
    return {};
  }

  // TODO Add any properities that should cause your element to re-render here
  // https://lit-element.polymer-project.org/guide/properties
  //@property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: Floor3dCardConfig;

  // https://lit-element.polymer-project.org/guide/properties#accessors-custom
  public setConfig(config: Floor3dCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    console.log('Set Config');

    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    this._config = config;
    this._configArray = createConfigArray(this._config);
    this._object_ids = createObjectGroupConfigArray(this._config);
    this._initialmaterial = [];
    this._clonedmaterial = [];
    let i = 0;

    this._object_ids.forEach((entity) => {
      this._initialmaterial.push([]);
      this._clonedmaterial.push([]);

      entity.objects.forEach(() => {
        this._initialmaterial[i].push(null);
        this._clonedmaterial[i].push(null);
      });
      i += 1;
    });

    if (this._config.show_warning) {
      render(this._showWarning(localize('common.show_warning')), this._card);
      return;
    }

    if (this._config.show_error) {
      render(this._showError(localize('common.show_error')), this._card);
      return;
    }
  }

  public rerender(): void {
    this._content.removeEventListener('dblclick', this._performActionListener);
    this._content.removeEventListener('touchstart', this._performActionListener);
    this._controls.removeEventListener('change', this._changeListener);
    this._renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    window.clearInterval(this._zIndexInterval);

    this._renderer.domElement.remove();
    this._renderer = null;

    this._states = null;
    this.hass = this._hass;
    this.display3dmodel();
  }

  private _ispanel(): boolean {
    let root: any = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver');
    root = (root && root.shadowRoot) || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    root = root && root.shadowRoot;
    root = root && root.querySelector('ha-app-layout');

    const panel: [] = root.getElementsByTagName('HUI-PANEL-VIEW');

    if (panel.length == 0) {
      return false;
    } else {
      return true;
    }
  }

  private _issidebar(): boolean {
    let root: any = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver');
    root = (root && root.shadowRoot) || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    root = root && root.shadowRoot;
    root = root && root.querySelector('ha-app-layout');

    const sidebar: [] = root.getElementsByTagName('HUI-SIDEBAR-VIEW');

    if (sidebar.length == 0) {
      return false;
    } else {
      return true;
    }
  }

  getCardSize(): number {
    console.log('Get Card Size Called');
    if (this._renderer) {
      //return this._renderer.domElement.height / 50;
      return 10;
    } else {
      return 10;
    }
  }

  firstUpdated(): void {
    //called after the model has been loaded into the Renderer and first render
    console.log('First updated start');

    this._card = this.shadowRoot.getElementById(this._card_id);
    if (this._card) {
      if (!this._content) {
        this._content = document.createElement('div');
        this._content.style.width = '100%';
        this._content.style.height = '100%';
        this._content.style.alignContent = 'center';
        this._card.appendChild(this._content);
      }
      if (!this._ispanel()) {
        (this._card as any).header = this._config.name ? this._config.name : 'Floor 3d';
      }

      if (this._content && !this._renderer) {
        this.display3dmodel();
      }

      console.log('First updated end');
    }
  }

  private _render(): void {
    //render the model
    this._direction_light.position.set(this._camera.position.x, this._camera.position.y, this._camera.position.z);
    this._direction_light.rotation.set(this._camera.rotation.x, this._camera.rotation.y, this._camera.rotation.z);
    this._renderer.render(this._scene, this._camera);
  }

  private _performAction(e: any): void {
    //double click on object to show the name
    const mouse: THREE.Vector2 = new THREE.Vector2();
    mouse.x = (e.offsetX / this._content.clientWidth) * 2 - 1;
    mouse.y = -(e.offsetY / this._content.clientHeight) * 2 + 1;
    const raycaster: THREE.Raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);
    const intersects: THREE.Intersection[] = raycaster.intersectObjects(this._scene.children, true);
    if (intersects.length > 0 && intersects[0].object.name != '') {
      if (getLovelace().editMode) {
        window.prompt('Object:', intersects[0].object.name);
      } else {
        this._config.entities.forEach((entity, i) => {
          if (entity.type3d == 'light' || entity.type3d == 'gesture') {
            for (let j = 0; j < this._object_ids[i].objects.length; j++) {
              if (this._object_ids[i].objects[j].object_id == intersects[0].object.name) {
                if (entity.type3d == 'light') {
                  this._hass.callService(entity.entity.split('.')[0], 'toggle', {
                    entity_id: entity.entity,
                  });
                } else if (entity.type3d == 'gesture') {
                  this._hass.callService(entity.gesture.domain, entity.gesture.service, {
                    entity_id: entity.entity,
                  });
                }
                break;
              }
            }
          }
        });
      }
    } else if (getLovelace().editMode) {
      window.prompt(
        'YAML:',
        'camera_position: { x: ' +
        this._camera.position.x +
        ', y: ' +
        this._camera.position.y +
        ', z: ' +
        this._camera.position.z +
        ' }\n' +
        'camera_rotate: { x: ' +
        this._camera.rotation.x +
        ', y: ' +
        this._camera.rotation.y +
        ', z: ' +
        this._camera.rotation.z +
        ' }',
      );
    }
  }

  private _zIndexChecker(): void {
    let centerX = (this._card.getBoundingClientRect().left + this._card.getBoundingClientRect().right) / 2;
    let centerY = (this._card.getBoundingClientRect().top + this._card.getBoundingClientRect().bottom) / 2;
    let topElement = this._haShadowRoot.elementFromPoint(centerX, centerY);

    if (topElement != null) {
      let topZIndex = this._getZIndex(topElement.shadowRoot.firstElementChild);
      let myZIndex = this._getZIndex(this._card);

      if (myZIndex != topZIndex) {
        if (!this._cardObscured) {
          this._cardObscured = true;

          if (this._to_animate) {
            console.log("Canvas Obscured; stopping animation");
            this._clock = null;
            this._renderer.setAnimationLoop(null);
          }
        }
      }
      else {
        if (this._cardObscured) {
          this._cardObscured = false;

          if (this._to_animate) {
            console.log("Canvas visible again; starting animation");
            this._clock = new THREE.Clock();
            this._renderer.setAnimationLoop(() => this._rotateobjects());
          }
        }
      }
    }
  }

  private _getZIndex(toCheck: any): string {
    let returnVal: string;

    returnVal = getComputedStyle(toCheck).getPropertyValue('--dialog-z-index');
    if (returnVal == '') {
      returnVal = getComputedStyle(toCheck).getPropertyValue('z-index');
    }

    if (returnVal == '' || returnVal == 'auto') {
      if (toCheck.parentNode.constructor.name == 'ShadowRoot') {
        return this._getZIndex(toCheck.parentNode.host);
      }
      else if (toCheck.parentNode.constructor.name == 'HTMLDocument') {
        return '0';
      }
      else {
        return this._getZIndex(toCheck.parentNode);
      }
    }

    return returnVal;
  }

  private _resizeCanvasDebounce(): void {
    window.clearTimeout(this._resizeTimeout);
    this._resizeTimeout = window.setTimeout(() => {
      this._resizeCanvas();
    }, 50);
  }

  private _resizeCanvas(): void {
    console.log('Resize canvas start');
    if (
      this._renderer.domElement.parentElement.clientWidth !== this._renderer.domElement.width ||
      this._renderer.domElement.parentElement.clientHeight !== this._renderer.domElement.height
    ) {
      this._camera.aspect =
        this._renderer.domElement.parentElement.clientWidth / this._renderer.domElement.parentElement.clientHeight;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(
        this._renderer.domElement.parentElement.clientWidth,
        this._renderer.domElement.parentElement.clientHeight,
        !this._issidebar(),
      );
      this._renderer.render(this._scene, this._camera);
    }
    console.log('Resize canvas end');
  }

  private _statewithtemplate(entity: Floor3dCardConfig): string {
    if (this._hass.states[entity.entity]) {
      let state = this._hass.states[entity.entity].state;

      if (entity.entity_template) {
        const trimmed = entity.entity_template.trim();

        if (trimmed.substring(0, 3) === '[[[' && trimmed.slice(-3) === ']]]' && trimmed.includes('$entity')) {
          const normal = trimmed.slice(3, -3).replace(/\$entity/g, state);
          state = this._eval(normal);
        }
      }
      return state;
    } else {
      return '';
    }
  }

  public set hass(hass: HomeAssistant) {
    //called by Home Assistant Lovelace when a change of state is detected in entities
    this._hass = hass;
    if (this._config.entities) {
      if (!this._states) {
        //prepares to save the state
        this._states = [];
        this._unit_of_measurement = [];
        this._color = [];
        this._brightness = [];
        this._lights = [];
        this._canvas = [];
        this._text = [];

        this._config.entities.forEach((entity) => {
          if (entity.entity !== '') {
            this._states.push(this._statewithtemplate(entity));
            this._canvas.push(null);
            if (entity.type3d == 'text') {
              if (entity.text.attribute) {
                if (hass.states[entity.entity].attributes[entity.text.attribute]) {
                  this._text.push(hass.states[entity.entity].attributes[entity.text.attribute]);
                } else {
                  this._text.push('');
                }
              } else {
                this._text.push(this._statewithtemplate(entity))
              }
            } else {
              this._text.push('');
            }
            if (entity.type3d == 'light') {
              this._lights.push(entity.object_id + '_light');
            } else {
              this._lights.push('');
            }
            let i = this._color.push([255, 255, 255]) - 1;
            if (hass.states[entity.entity].attributes['color_mode']) {
              if ((hass.states[entity.entity].attributes['color_mode'] = 'color_temp')) {
                this._color[i] = this._TemperatureToRGB(parseInt(hass.states[entity.entity].attributes['color_temp']));
              }
            }
            if ((hass.states[entity.entity].attributes['color_mode'] = 'rgb')) {
              if (hass.states[entity.entity].attributes['rgb_color'] !== this._color[i]) {
                this._color[i] = hass.states[entity.entity].attributes['rgb_color'];
              }
            }
            let j = this._brightness.push(-1) - 1;
            if (hass.states[entity.entity].attributes['brightness']) {
              this._brightness[j] = hass.states[entity.entity].attributes['brightness'];
            }
            if (hass.states[entity.entity].attributes['unit_of_measurement']) {
              this._unit_of_measurement.push(hass.states[entity.entity].attributes['unit_of_measurement']);
            } else {
              this._unit_of_measurement.push('');
            }
          }
        });
        this._firstcall = false;
      }

      if (this._renderer && this._modelready) {
        let torerender = false;
        this._config.entities.forEach((entity, i) => {
          if (entity.entity !== '') {
            let state = this._statewithtemplate(entity);
            if (entity.type3d == 'light') {
              let toupdate = false;
              if (this._states[i] !== state) {
                this._states[i] = state;
                toupdate = true;
              }
              if (hass.states[entity.entity].attributes['color_mode']) {
                if ((hass.states[entity.entity].attributes['color_mode'] = 'color_temp')) {
                  if (
                    this._TemperatureToRGB(parseInt(hass.states[entity.entity].attributes['color_temp'])) !==
                    this._color[i]
                  ) {
                    toupdate = true;
                    this._color[i] = this._TemperatureToRGB(
                      parseInt(hass.states[entity.entity].attributes['color_temp']),
                    );
                  }
                }
                if ((hass.states[entity.entity].attributes['color_mode'] = 'rgb')) {
                  if (hass.states[entity.entity].attributes['rgb_color'] !== this._color[i]) {
                    toupdate = true;
                    this._color[i] = hass.states[entity.entity].attributes['rgb_color'];
                  }
                }
              }
              if (hass.states[entity.entity].attributes['brightness']) {
                if (hass.states[entity.entity].attributes['brightness'] !== this._brightness[i]) {
                  toupdate = true;
                  this._brightness[i] = hass.states[entity.entity].attributes['brightness'];
                }
              }
              if (toupdate) {
                this._updatelight(entity, i);
                torerender = true;
              }
            } else if (entity.type3d == 'text') {
              let toupdate = false;
              if (entity.text.attribute) {
                if (hass.states[entity.entity].attributes[entity.text.attribute]) {
                  if (this._text[i] != hass.states[entity.entity].attributes[entity.text.attribute]) {
                    this._text[i] = hass.states[entity.entity].attributes[entity.text.attribute];
                    toupdate = true;
                  }
                } else {
                  this._text[i] = '';
                  toupdate = true;
                }
              } else {
                if (this._text[i] != this._statewithtemplate(entity)) {
                  this._text[i] = this._statewithtemplate(entity);
                  toupdate = true;
                }
              }
              if (this._canvas[i] && toupdate) {
                this._updatetext(entity, this._text[i], this._canvas[i], this._unit_of_measurement[i]);
                torerender = true;
              }
            } else if (entity.type3d == 'rotate') {
              this._states[i] = state;
              this._rotatecalc(entity, i);
            } else if (this._states[i] !== state) {
              this._states[i] = state;
              if (entity.type3d == 'color') {
                this._updatecolor(entity, i);
                torerender = true;
              } else if (entity.type3d == 'hide') {
                this._updatehide(entity, i);
                torerender = true;
              } else if (entity.type3d == 'show') {
                this._updateshow(entity, i);
                torerender = true;
              } else if (entity.type3d == 'door') {
                this._updatedoor(entity, i);
                torerender = true;
              }
            }
          }
        });
        if (torerender) {
          this._render();
        }
      }
    }
  }

  protected display3dmodel(): void {
    //load the model into the GL Renderer
    console.log('Start Build Renderer');
    this._modelready = false;
    this._scene = new THREE.Scene();
    if (this._config.backgroundColor && this._config.backgroundColor != '#000000') {
      this._scene.background = new THREE.Color(this._config.backgroundColor);
    } else {
      this._scene.background = new THREE.Color('#aaaaaa');
    }
    this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 99999999);
    this._ambient_light = new THREE.AmbientLight(0xffffff, 0.5);
    this._direction_light = new THREE.DirectionalLight(0xffffff, 0.5);
    this._direction_light.matrixAutoUpdate = true;
    this._direction_light.castShadow = false;
    this._scene.add(this._direction_light);
    this._scene.add(this._ambient_light);
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._maxtextureimage = this._renderer.context.getParameter(
      this._renderer.context.MAX_TEXTURE_IMAGE_UNITS
    );
    console.log("Max Texture Image Units: " + this._maxtextureimage);
    console.log(
      "Max Texture Image Units: number of lights casting shadow should be less than the above number"
    );
    this._renderer.domElement.style.width = '100%';
    this._renderer.domElement.style.height = '100%';
    this._renderer.domElement.style.display = 'block';
    if (this._config.path && this._config.path != '') {
      let path = this._config.path;
      const lastChar = path.substr(-1);
      if (lastChar != '/') {
        path = path + '/';
      }
      console.log('Path: ' + path);
      if (this._config.mtlfile && this._config.mtlfile != '') {
        const mtlLoader: MTLLoader = new MTLLoader();
        mtlLoader.setPath(path);
        mtlLoader.load(
          this._config.mtlfile,
          this._onLoaded3DMaterials.bind(this),
          this._onLoadMaterialProgress.bind(this),
          function (error: ErrorEvent): void {
            throw new Error(error.error);
          },
        );
      } else {
        const objLoader: OBJLoader = new OBJLoader();
        objLoader.load(
          path + this._config.objfile,
          this._onLoaded3DModel.bind(this),
          this._onLoadObjectProgress.bind(this),
          function (error: ErrorEvent): void {
            throw new Error(error.error);
          },
        );
      }
    } else {
      throw new Error('Path is empty');
    }
    console.log('End Build Renderer');
  }

  private _onLoadError(event: ErrorEvent): void {
    this._showError(event.error);
  }

  private _onLoadMaterialProgress(_progress: ProgressEvent): void {
    //progress function called at regular intervals during material loading process
    this._content.innerText = '1/2: ' + Math.round((_progress.loaded / _progress.total) * 100) + '%';
  }

  private _onLoadObjectProgress(_progress: ProgressEvent): void {
    //progress function called at regular intervals during object loading process
    this._content.innerText = '2/2: ' + Math.round((_progress.loaded / _progress.total) * 100) + '%';
  }

  private _onLoaded3DModel(object: THREE.Object3D): void {
    // Object Loaded Event: last root object passed to the function

    console.log('Object loaded start');


    let model_array = [];

    this._bboxmodel = object;
    this._scene.add(this._bboxmodel);

    this._content.innerText = '2/2: 100%';

    //this._scene.add(new THREE.AxesHelper(300));
    const box: THREE.Box3 = new THREE.Box3().setFromObject(this._bboxmodel);

    if (this._config.camera_position) {
      this._camera.position.set(
        this._config.camera_position.x,
        this._config.camera_position.y,
        this._config.camera_position.z,
      );
      this._direction_light.position.set(
        this._config.camera_position.x,
        this._config.camera_position.y,
        this._config.camera_position.z,
      );
    } else {
      this._camera.position.set(box.max.x * 1.3, box.max.y * 5, box.max.z * 1.3);
      this._direction_light.position.set(box.max.x * 1.3, box.max.y * 5, box.max.z * 1.3);
    }


    this._modelX = this._bboxmodel.position.x = -(box.max.x - box.min.x) / 2;
    this._modelY = this._bboxmodel.position.y = -box.min.y;
    this._modelZ = this._bboxmodel.position.z = -(box.max.z - box.min.z) / 2;

    if (this._config.shadow) {
      if (this._config.shadow == 'yes') {
        console.log('Shadow On');
        this._renderer.shadowMap.enabled = true;
        this._bboxmodel.traverse(this._setShadow.bind(this));
      } else {
        console.log('Shadow Off');
        this._renderer.shadowMap.enabled = false;
      }
    }


    if (this._config.camera_rotate) {
      this._camera.rotation.set(
        this._config.camera_rotate.x,
        this._config.camera_rotate.y,
        this._config.camera_rotate.z,
      );
      this._direction_light.rotation.set(
        this._config.camera_rotate.x,
        this._config.camera_rotate.y,
        this._config.camera_rotate.z,
      );
    } else {
      this._camera.lookAt(box.max.multiplyScalar(0.5));
      this._direction_light.lookAt(box.max.multiplyScalar(0.5));
    }
    this._add3dObjects();
    console.log('Object loaded end');

    if (this._content && this._renderer) {
      this._modelready = true;
      console.log('Show canvas');
      this._content.innerText = '';
      this._content.appendChild(this._renderer.domElement);

      this._content.addEventListener('dblclick', this._performActionListener);
      this._content.addEventListener('touchstart', this._performActionListener);
      this._controls = new OrbitControls(this._camera, this._renderer.domElement);
      this._controls.maxPolarAngle = (0.9 * Math.PI) / 2;
      this._controls.addEventListener('change', this._changeListener);
      this._renderer.setPixelRatio(window.devicePixelRatio);
      // ambient and directional light

      if (this._hass.states[this._config.globalLightPower]) {
        if (!Number.isNaN(this._hass.states[this._config.globalLightPower].state)) {
          this._ambient_light.intensity = this._direction_light.intensity = Number(
            this._hass.states[this._config.globalLightPower].state,
          );
        }
      } else {
        if (this._config.globalLightPower) {
          this._ambient_light.intensity = this._direction_light.intensity = Number(this._config.globalLightPower);
        } else {
          this._ambient_light.intensity = this._direction_light.intensity = 0.5;
        }
      }
      //first render
      this._render();
      this._resizeCanvas();

      this._zIndexInterval = window.setInterval(() => {
        this._zIndexChecker();
      }, 250);

      if (this._ispanel() || this._issidebar()) {
        this._resizeObserver.observe(this._card);
      }
    }
  }

  private _setNoShadowLight(object: THREE.Object3D): void {
    object.receiveShadow = true;
    object.castShadow = false;
    return;
  }

  private _setShadow(object: THREE.Object3D): void {
    object.receiveShadow = true;
    object.castShadow = true;
    return;
  }

  private _onLoaded3DMaterials(materials: MTLLoader.MaterialCreator): void {
    // Materials Loaded Event: last root material passed to the function
    console.log('Material loaded start');
    materials.preload();
    let path = this._config.path;
    const lastChar = path.substr(-1);
    if (lastChar != '/') {
      path = path + '/';
    }
    const objLoader: OBJLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load(
      path + this._config.objfile,
      this._onLoaded3DModel.bind(this),
      this._onLoadObjectProgress.bind(this),
      function (error: ErrorEvent): void {
        throw new Error(error.error);
      },
    );
    console.log('Material loaded end');
  }

  private _add3dObjects(): void {
    // Add-Modify the objects bound to the entities in the card config
    console.log('Add Objects Start');
    if (this._states && this._config.entities) {
      this._round_per_seconds = [];
      this._axis_to_rotate = [];
      this._rotation_state = [];
      this._rotation_index = [];
      this._pivot = [];
      this._axis_for_door = [];
      this._degrees = [];
      this._slidingdoor = [];
      this._objposition = [];
      this._slidingdoorposition = [];
      this._to_animate = false;

      this._config.entities.forEach((entity, i) => {
        this._objposition.push([0, 0, 0]);
        this._pivot.push(null);
        this._axis_for_door.push(null);
        this._degrees.push(0);
        this._slidingdoor.push(null);
        this._slidingdoorposition.push([]);
        if (entity.entity !== '') {
          if (entity.type3d == 'rotate') {
            //console.log("Start Add Rotate Object");
            this._round_per_seconds.push(entity.rotate.round_per_second);
            this._axis_to_rotate.push(entity.rotate.axis);
            this._rotation_state.push(0);
            this._rotation_index.push(i);
            let bbox: THREE.Box3;
            let hinge: any;
            if (entity.rotate.hinge) {
              hinge = this._scene.getObjectByName(entity.rotate.hinge);
            } else {
              hinge = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id);
            }
            bbox = new THREE.Box3().setFromObject(hinge);
            this._pivot[i] = new THREE.Vector3;
            this._pivot[i].subVectors(bbox.max, bbox.min).multiplyScalar(0.5);
            this._pivot[i].add(bbox.min);

            this._object_ids[i].objects.forEach(element => {

              let _obj: any = this._scene.getObjectByName(element.object_id);
              this._centerobjecttopivot(_obj, this._pivot[i]);
              _obj.geometry.applyMatrix4(
                new THREE.Matrix4().makeTranslation(
                  -(this._pivot[i].x),
                  -(this._pivot[i].y),
                  -(this._pivot[i].z)
                )
              );

            });
            //console.log("End Add Rotate Object");
          }
          if (entity.type3d == 'door') {
            if (entity.door.doortype == "swing") {
              //console.log("Start Add Door Swing");
              let position = new THREE.Vector3();
              if (entity.door.hinge) {
                let hinge: THREE.Mesh = this._scene.getObjectByName(entity.door.hinge) as THREE.Mesh;
                hinge.geometry.computeBoundingBox();
                let boundingBox = hinge.geometry.boundingBox;
                position.subVectors(boundingBox.max, boundingBox.min);
                switch (Math.max(position.x, position.y, position.z)) {
                  case position.x:
                    this._axis_for_door[i] = new THREE.Vector3(1, 0, 0);
                    break;
                  case position.z:
                    this._axis_for_door[i] = new THREE.Vector3(0, 0, 1);
                    break;
                  case position.y:
                  default:
                    this._axis_for_door[i] = new THREE.Vector3(0, 1, 0);
                }
                position.multiplyScalar(0.5);
                position.add(boundingBox.min);
                position.applyMatrix4(hinge.matrixWorld);
              } else {

                let pane: THREE.Mesh;

                if (entity.door.pane) {
                  pane = this._scene.getObjectByName(entity.door.pane) as THREE.Mesh;
                } else {
                  pane = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id) as THREE.Mesh;
                }

                pane.geometry.computeBoundingBox();
                let boundingBox = pane.geometry.boundingBox;
                position.subVectors(boundingBox.max, boundingBox.min);
                if (entity.door.side) {

                  switch (entity.door.side) {

                    case "up":
                      position.x = position.x / 2;
                      position.z = position.z / 2;
                      position.y = position.y;
                      if (position.x > position.z) {
                        this._axis_for_door[i] = new THREE.Vector3(1, 0, 0);
                      } else {
                        this._axis_for_door[i] = new THREE.Vector3(0, 0, 1);
                      }
                      break;
                    case "down":
                      position.x = position.x / 2;
                      position.z = position.z / 2;
                      position.y = 0;
                      if (position.x > position.z) {
                        this._axis_for_door[i] = new THREE.Vector3(1, 0, 0);
                      } else {
                        this._axis_for_door[i] = new THREE.Vector3(0, 0, 1);
                      }
                      break;
                    case "left":
                      if (position.x > position.z) {

                        position.x = 0;
                        position.z = position.z / 2;

                      } else {

                        position.z = 0;
                        position.x = position.x / 2;

                      }
                      this._axis_for_door[i] = new THREE.Vector3(0, 1, 0);
                      position.y = 0;
                      break;
                    case "right":
                      if (position.x > position.z) {

                        position.z = position.z / 2;

                      } else {

                        position.x = position.x / 2;

                      }
                      this._axis_for_door[i] = new THREE.Vector3(0, 1, 0);
                      position.y = 0;
                      break;
                  }

                }
                position.add(boundingBox.min);
                position.applyMatrix4(pane.matrixWorld);

              }

              this._pivot[i] = position;
              this._degrees[i] = (entity.door.degrees) ? (entity.door.degrees) : 90;
              this._object_ids[i].objects.forEach(element => {

                let _obj: any = this._scene.getObjectByName(element.object_id);

                this._centerobjecttopivot(_obj, this._pivot[i]);

                _obj.geometry.applyMatrix4(
                  new THREE.Matrix4().makeTranslation(
                    -(this._pivot[i].x),
                    -(this._pivot[i].y),
                    -(this._pivot[i].z)
                  )
                );

              });

              //console.log("End Add Door Swing");
            } else if (entity.door.doortype == "slide") {

              //console.log("Start Add Door Slide");

              this._object_ids[i].objects.forEach((element) => {
                let _obj: any = this._scene.getObjectByName(element.object_id);
                let objbbox = new THREE.Box3().setFromObject(_obj);
                this._slidingdoorposition[i].push(objbbox.min);
                this._centerobjecttopivot(_obj, objbbox.min);
                _obj.geometry.applyMatrix4(
                  new THREE.Matrix4().makeTranslation(
                    -(objbbox.min.x),
                    -(objbbox.min.y),
                    -(objbbox.min.z)
                  )
                );
              });

              //console.log("End Add Door Slide");
            }

          }
          if (entity.type3d == 'light') {
            // Add Virtual Light Objects
            this._object_ids[i].objects.forEach((element) => {
              const _foundobject: any = this._scene.getObjectByName(element.object_id);
              if (_foundobject) {
                const box: THREE.Box3 = new THREE.Box3();
                box.setFromObject(_foundobject);
                const light: THREE.PointLight = new THREE.PointLight(new THREE.Color('#ffffff'), 0, 700, 2);
                let x: number, y: number, z: number;

                x = (box.max.x - box.min.x) / 2 + box.min.x;
                z = (box.max.z - box.min.z) / 2 + box.min.z;
                y = (box.max.y - box.min.y) / 2 + box.min.y;
                if (entity.light.vertical_alignment) {
                  switch (entity.light.vertical_alignment) {
                    case 'top':
                      y = box.max.y;
                      break;
                    case 'middle':
                      y = (box.max.y - box.min.y) / 2 + box.min.y;
                      break;
                    case 'bottom':
                      y = box.min.y;
                      break;
                  }
                }

                this._bboxmodel.add(light);
                light.position.set(x, y, z);
                this._setNoShadowLight(_foundobject);
                _foundobject.traverseAncestors(this._setNoShadowLight.bind(this));
                if (entity.light.shadow == "no") {
                  light.castShadow = false;
                } else {
                  light.castShadow = true;
                }
                light.name = element.object_id + '_light';
                //this._updatelight(entity, this._states[i], this._lights[i], this._color[i], this._brightness[i]);
              }
            });
          }
          if (entity.type3d == 'color') {
            // Clone Material to allow object color changes based on Color Conditions Objects
            let j = 0;
            this._object_ids[i].objects.forEach((element) => {
              let _foundobject: any = this._scene.getObjectByName(element.object_id);
              this._initialmaterial[i][j] = _foundobject.material;
              if (!Array.isArray(_foundobject.material)) {
                this._clonedmaterial[i][j] = _foundobject.material.clone();
              }
              j = j + 1;
            });
          }
        }
      });
      this._config.entities.forEach((entity, i) => {
        if (entity.entity !== '') {
          if (entity.type3d == 'light') {
            this._updatelight(entity, i);
          } else if (entity.type3d == 'color') {
            this._updatecolor(entity, i);
          } else if (entity.type3d == 'hide') {
            this._updatehide(entity, i);
          } else if (entity.type3d == 'show') {
            this._updateshow(entity, i);
          } else if (entity.type3d == 'door') {
            this._updatedoor(entity, i);
          } else if (entity.type3d == 'text') {
            this._canvas[i] = this._createTextCanvas(entity, this._text[i], this._unit_of_measurement[i]);
          } else if (entity.type3d == 'rotate') {
            this._rotatecalc(entity, i);
          }
        }
      });
    }
    console.log('Add 3D Object End');
  }

  // manage all entity types

  private _createTextCanvas(entity, text: string, uom: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    this._updateTextCanvas(entity, canvas, text + uom);

    return canvas;
  }

  private _updateTextCanvas(entity: Floor3dCardConfig, canvas: HTMLCanvasElement, text: string): void {
    const _foundobject: any = this._scene.getObjectByName(entity.object_id);

    const ctx = canvas.getContext('2d');

    // Prepare the font to be able to measure
    let fontSize = 56;
    ctx.font = `${fontSize}px ${entity.text.font ? entity.text.font : 'monospace'}`;

    const textMetrics = ctx.measureText(text);

    let width = textMetrics.width;
    let height = fontSize;

    let perct = 1.0;
    if (entity.text.span) {
      perct = parseFloat(entity.text.span) / 100.0;
    }
    // Resize canvas to match text size

    width = width / perct;
    height = height / perct;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Re-apply font since canvas is resized.
    ctx.font = `${fontSize}px ${entity.text.font ? entity.text.font : 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = entity.text.textbgcolor ? entity.text.textbgcolor : 'transparent';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = entity.text.textfgcolor ? entity.text.textfgcolor : 'white';

    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
    });
    if (_foundobject instanceof Mesh) {
      (_foundobject as Mesh).material = material;
    }
  }

  private _TemperatureToRGB(t: number): number[] {
    let temp = 10000 / t; //kelvins = 1,000,000/mired (and that /100)
    let r: number, g: number, b: number;
    let rgb: number[] = [0, 0, 0];

    if (temp <= 66) {
      r = 255;
      g = temp;
      g = 99.470802 * Math.log(g) - 161.119568;

      if (temp <= 19) {
        b = 0;
      } else {
        b = temp - 10;
        b = 138.517731 * Math.log(b) - 305.044793;
      }
    } else {
      r = temp - 60;
      r = 329.698727 * Math.pow(r, -0.13320476);

      g = temp - 60;
      g = 288.12217 * Math.pow(g, -0.07551485);

      b = 255;
    }
    rgb = [Math.floor(r), Math.floor(g), Math.floor(b)];
    return rgb;
  }

  private _RGBToHex(r: number, g: number, b: number): string {
    // RGB Color array to hex string converter
    let rs: string = r.toString(16);
    let gs: string = g.toString(16);
    let bs: string = b.toString(16);

    if (rs.length == 1) rs = '0' + rs;
    if (gs.length == 1) gs = '0' + gs;
    if (bs.length == 1) bs = '0' + bs;

    return '#' + rs + gs + bs;
  }

  private _updatetext(_item: Floor3dCardConfig, state: string, canvas: HTMLCanvasElement, uom: string): void {
    this._updateTextCanvas(_item, canvas, state + uom);
  }

  private _updatelight(item: Floor3dCardConfig, i: number): void {
    // Illuminate the light object when, for the bound device, one of its attribute gets modified in HA. See set hass property

    this._object_ids[i].objects.forEach((element) => {
      const light: any = this._scene.getObjectByName(element.object_id + '_light');

      if (!light) {
        return;
      }
      let max: number;

      if (item.light.lumens) {
        max = item.light.lumens;
      } else {
        max = 800;
      }

      if (this._states[i] == 'on') {
        if (this._brightness[i] != -1) {
          light.intensity = 0.003 * max * (this._brightness[i] / 255);
        } else {
          light.intensity = 0.003 * max;
        }
        if (!this._color[i]) {
          light.color = new THREE.Color('#ffffff');
        } else {
          light.color = new THREE.Color(this._RGBToHex(this._color[i][0], this._color[i][1], this._color[i][2]));
        }
      } else {
        light.intensity = 0;
        //light.color = new THREE.Color('#000000');
      }
    });
  }

  private _updatedoor(item: Floor3dCardConfig, i: number): void {
    // perform action of door objects

    const _obj: any = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id);

    let door: THREE.Mesh;

    door = _obj;

    if (door) {
      if (item.door.doortype) {
        if (item.door.doortype == 'swing') {
          this._rotatedoorpivot(item, i);
          return;
        } else if (item.door.doortype == 'slide') {
          this._translatedoor(item, i, this._states[i]);
          return;
        }
      }
    }

  }

  private _centerobjecttopivot(object: THREE.Mesh, pivot: THREE.Vector3) {

    object.applyMatrix4(
      new THREE.Matrix4().makeTranslation(
        -(pivot.x),
        -(pivot.y),
        -(pivot.z)
      )
    );
    object.position.copy(pivot);

  }

  private _rotatedoorpivot(entity: Floor3dCardConfig, index: number) {

    this._object_ids[index].objects.forEach(element => {

      let _obj: any = this._scene.getObjectByName(element.object_id);

      //this._centerobjecttopivot(_obj, this._pivot[index]);

      if (this._states[index] == "on") {
        if (entity.door.direction == "inner") {
          //_obj.rotateOnAxis(this._axis_for_door[index], -Math.PI * this._degrees[index] / 180);

          if (this._axis_for_door[index].y == 1) {
            _obj.rotation.y = -Math.PI * this._degrees[index] / 180;
          } else if (this._axis_for_door[index].x == 1) {
            _obj.rotation.x = -Math.PI * this._degrees[index] / 180;
          } else if (this._axis_for_door[index].z == 1) {
            _obj.rotation.z = -Math.PI * this._degrees[index] / 180;
          }
        } else if (entity.door.direction == "outer") {
          //_obj.rotateOnAxis(this._axis_for_door[index], Math.PI * this._degrees[index] / 180);
          if (this._axis_for_door[index].y == 1) {
            _obj.rotation.y = Math.PI * this._degrees[index] / 180;
          } else if (this._axis_for_door[index].x == 1) {
            _obj.rotation.x = Math.PI * this._degrees[index] / 180;
          } else if (this._axis_for_door[index].z == 1) {
            _obj.rotation.z = Math.PI * this._degrees[index] / 180;
          }
        }

      } else {
        _obj.rotation.x = 0;
        _obj.rotation.y = 0;
        _obj.rotation.z = 0;
      }

    });


  }


  private _rotatecalc(entity: Floor3dCardConfig, i: number) {

    let j = this._rotation_index.indexOf(i);

    //1 if the entity is on, 0 if the entity is off
    this._rotation_state[j] = (this._states[i] == 'on' ? 1 : 0);

    //If the entity is on and it has the 'percentage' attribute, convert the percentage integer
    //into a decimal and store it as the rotation state
    if (this._rotation_state[j] != 0 && this._hass.states[entity.entity].attributes['percentage']) {
      this._rotation_state[j] = this._hass.states[entity.entity].attributes['percentage'] / 100;
    }

    //If the entity is on and it is reversed, set the rotation state to the negative value of itself
    if (
      this._rotation_state[j] != 0 && this._hass.states[entity.entity].attributes['direction'] &&
      this._hass.states[entity.entity].attributes['direction'] == 'reverse'
    ) {
      this._rotation_state[j] = 0 - this._rotation_state[j];
    }

    //If every rotating entity is stopped, disable animation
    if (this._rotation_state.every(item => item === 0)) {
      if (this._to_animate) {
        this._to_animate = false;
        this._clock = null;
        this._renderer.setAnimationLoop(null);
      }
    }

    //Otherwise, start an animation loop
    else if (!this._to_animate) {
      this._to_animate = true;
      this._clock = new THREE.Clock();
      this._renderer.setAnimationLoop(() => this._rotateobjects());
    }
  }

  private _rotateobjects() {
    let moveBy = this._clock.getDelta() * Math.PI * 2;

    this._rotation_state.forEach((state, index) => {
      if (state != 0) {
        this._object_ids[this._rotation_index[index]].objects.forEach(element => {
          let _obj = this._scene.getObjectByName(element.object_id);
          if (_obj) {
            switch (this._axis_to_rotate[index]) {
              case "x":
                _obj.rotation.x += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
              case "y":
                _obj.rotation.y += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
              case "z":
                _obj.rotation.z += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
            }
          }

        });
      }
    });

    this._renderer.render(this._scene, this._camera);
  }


  private _translatedoor(item: Floor3dCardConfig, index: number, doorstate: string) {

    //console.log("Translate Door Start");

    let translate: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    let size: Vector3 = new THREE.Vector3();
    let center: Vector3 = new THREE.Vector3();

    let pane = this._scene.getObjectByName(item.door.pane);

    if (!pane) {
      pane = this._scene.getObjectByName(this._object_ids[index].objects[0].object_id);
    }
    let bbox = new THREE.Box3().setFromObject(pane);

    size.subVectors(bbox.max, bbox.min);

    let percentage: number;

    if (item.door.percentage) {
      percentage = item.door.percentage;
    }
    else {
      percentage = 100;
    }

    if (doorstate == 'off') {
      this._object_ids[index].objects.forEach((element, j) => {
        let _obj: any = this._scene.getObjectByName(element.object_id);
        _obj.position.set(this._slidingdoorposition[index][j].x, this._slidingdoorposition[index][j].y, this._slidingdoorposition[index][j].z);
      });

    } else if (doorstate == 'on') {
      if (item.door.side == 'left') {
        if (size.x > size.z) {
          translate.z += 0;
          translate.x += -size.x * percentage / 100;
          translate.y = 0
        } else {
          translate.z += -size.z * percentage / 100;
          translate.x += 0;
          translate.y += 0;
        }
      } else if (item.door.side == 'right') {
        if (size.x > size.z) {
          translate.z += 0;
          translate.x += +size.x * percentage / 100;
          translate.y += 0;
        } else {
          translate.z += +size.z * percentage / 100;
          translate.x += 0;
          translate.y += 0
        }
      } else if (item.door.side == 'down') {
        translate.y += -size.y * percentage / 100;
        translate.x += 0;
        translate.z += 0;
      } else if (item.door.side == 'up') {
        translate.y += +size.y * percentage / 100;
        translate.x += 0;
        translate.z += 0;
      }
      this._object_ids[index].objects.forEach((element) => {
        let _obj: any = this._scene.getObjectByName(element.object_id);
        _obj.applyMatrix4(
          new THREE.Matrix4().makeTranslation(
            (translate.x),
            (translate.y),
            (translate.z)
          )
        );
      });

    }
  }

  private _updatecolor(item: any, index: number): void {
    // Change the color of the object when, for the bound device, the state matches the condition

    let j = 0;
    this._object_ids[index].objects.forEach((element) => {
      let _object: any = this._scene.getObjectByName(element.object_id);

      if (_object) {
        let i: any;
        let defaultcolor = true;
        for (i in item.colorcondition) {
          if (this._states[index] == item.colorcondition[i].state) {
            const colorarray = item.colorcondition[i].color.split(',');
            let color = '';
            if (colorarray.length == 3) {
              color = this._RGBToHex(Number(colorarray[0]), Number(colorarray[1]), Number(colorarray[2]));
            } else {
              color = item.colorcondition[i].color;
            }
            if (!Array.isArray(_object.material)) {
              _object.material = this._clonedmaterial[index][j];
              _object.material.color.set(color);
            }
            defaultcolor = false;
            break;
          }
        }
        if (defaultcolor) {
          if (this._initialmaterial[index][j]) {
            _object.material = this._initialmaterial[index][j];
          }
        }
      }
      j += 1;
    });
  }

  private _updatehide(item: Floor3dCardConfig, index: number): void {
    // hide the object when the state is equal to the configured value
    this._object_ids[index].objects.forEach((element) => {
      const _object: any = this._scene.getObjectByName(element.object_id);

      if (_object) {
        if (this._states[index] == item.hide.state) {
          _object.visible = false;
        } else {
          _object.visible = true;
        }
      }
    });
  }

  private _updateshow(item: Floor3dCardConfig, index: number): void {
    // hide the object when the state is equal to the configured value
    this._object_ids[index].objects.forEach((element) => {
      const _object: any = this._scene.getObjectByName(element.object_id);

      if (_object) {
        if (this._states[index] == item.show.state) {
          _object.visible = true;
        } else {
          _object.visible = false;
        }
      }
    });
  }

  // end of manage entity types

  // https://lit-element.polymer-project.org/guide/lifecycle#shouldupdate
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return true;
    //return hasConfigOrEntityChanged(this, _changedProps, false);
  }

  // https://lit-element.polymer-project.org/guide/templates

  protected render(): TemplateResult | void {
    if (this._config.show_error) {
      return this._showError(localize('common.show_error'));
    }

    let htmlHeight: string;
    if (this._ispanel()) htmlHeight = 'calc(100vh - var(--header-height))';
    else htmlHeight = 'auto';

    return html`
      <ha-card tabindex="0" .style=${`${this._config.style || 'overflow: hidden; width: auto; height: ' + htmlHeight + ';'}`}
        id="${this._card_id}">
      </ha-card>
    `;
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    //not implemented to not interfere with  the Action handler of the Three.js canvas object
    if (this.hass && this._config && ev.detail.action) {
      handleAction(this, this.hass, this._config, ev.detail.action);
    }
  }

  private _showWarning(warning: string): TemplateResult {
    return html`<hui-warning>${warning}</hui-warning>`;
  }

  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this._config,
    });

    return html`${errorCard}`;
  }

  // https://lit-element.polymer-project.org/guide/styles
  static get styles(): CSSResultGroup {
    return css``;
  }
}
