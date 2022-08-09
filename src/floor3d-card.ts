/* eslint-disable @typescript-eslint/ban-types */
import { LitElement, html, TemplateResult, css, PropertyValues, CSSResultGroup, render } from 'lit';
import { property, customElement, state } from 'lit/decorators';
import {
  HomeAssistant,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
  fireEvent,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types
import './editor';
import { HassEntity } from 'home-assistant-js-websocket';
import { createConfigArray, createObjectGroupConfigArray } from './helpers';
import type { Floor3dCardConfig } from './types';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
//import three.js libraries for 3D rendering
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { Object3D } from 'three';
import '../elements/button';


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
  preview: true,
  description: 'A custom card to visualize and activate entities in a live 3D model',
});
class ModelSource {
  public static OBJ = 0;
  public static GLB = 1;
}

// TODO Name your custom element
@customElement('floor3d-card')
export class Floor3dCard extends LitElement {
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _renderer?: THREE.WebGLRenderer;
  private _levelbar?: HTMLElement;
  private _zoombar?: HTMLElement;
  private _controls?: OrbitControls;
  private _hemiLight?: THREE.HemisphereLight;
  private _modelX?: number;
  private _modelY?: number;
  private _modelZ?: number;
  private _to_animate: boolean;
  private _bboxmodel: THREE.Object3D;
  private _levels: THREE.Object3D[];
  private _displaylevels: boolean[];
  private _zoom: any[];
  private _selectedlevel: number;
  private _states?: string[];
  private _color?: number[][];
  private _raycasting: THREE.Object3D[];
  private _raycastinglevels: THREE.Object3D[][];
  private _initialmaterial?: THREE.Material[][];
  private _clonedmaterial?: THREE.Material[][];
  private _brightness?: number[];
  private _lights?: string[];
  private _rooms?: string[];
  private _sprites?: string[];
  private _canvas?: HTMLCanvasElement[];
  private _unit_of_measurement?: string[];
  private _text?: string[];
  private _spritetext?: string[];
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
  private _overlay_entity: string;
  private _overlay_state: string;

  private _eval: Function;
  private _firstcall?: boolean;
  private _resizeTimeout?: number;
  private _resizeObserver: ResizeObserver;
  private _zIndexInterval: number;
  private _performActionListener: EventListener;
  private _fireventListener: EventListener;
  private _changeListener: EventListener;
  private _cardObscured: boolean;
  private _card?: HTMLElement;
  private _content?: HTMLElement;
  private _modeltype?: ModelSource;
  private _config!: Floor3dCardConfig;
  private _configArray: Floor3dCardConfig[] = [];
  private _object_ids?: Floor3dCardConfig[] = [];
  private _overlay: HTMLDivElement;
  private _hass?: HomeAssistant;
  private _haShadowRoot: any;
  private _position: number[];
  private _card_id: string;
  private _ambient_light: any;
  private _torch: THREE.DirectionalLight;
  private _torchTarget: THREE.Object3D;
  private _sky: Sky;
  private _sun: THREE.DirectionalLight;
  _helper: THREE.DirectionalLightHelper;
  private _modelready: boolean;
  private _maxtextureimage: number;

  constructor() {
    super();

    this._cardObscured = false;
    this._resizeObserver = new ResizeObserver(() => {
      this._resizeCanvasDebounce();
    });
    this._performActionListener = (evt) => this._performAction(evt);
    this._fireventListener = (evt) => this._firevent(evt);
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
    await import('./editor');
    return document.createElement('floor3d-card-editor');
  }

  public static getStubConfig(hass: HomeAssistant, entities: string[], entitiesFallback: string[]): object {

    console.log("Stub started");

    const entityFilter = (stateObj: HassEntity): boolean => {
      return !isNaN(Number(stateObj.state));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _arrayFilter = (array: any[], conditions: Array<(value: any) => boolean>, maxSize: number) => {
      if (!maxSize || maxSize > array.length) {
        maxSize = array.length;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredArray: any[] = [];

      for (let i = 0; i < array.length && filteredArray.length < maxSize; i++) {
        let meetsConditions = true;

        for (const condition of conditions) {
          if (!condition(array[i])) {
            meetsConditions = false;
            break;
          }
        }

        if (meetsConditions) {
          filteredArray.push(array[i]);
        }
      }

      return filteredArray;
    };

    const _findEntities = (
      hass: HomeAssistant,
      maxEntities: number,
      entities: string[],
      entitiesFallback: string[],
      includeDomains?: string[],
      entityFilter?: (stateObj: HassEntity) => boolean,
    ) => {
      const conditions: Array<(value: string) => boolean> = [];

      if (includeDomains?.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        conditions.push((eid) => includeDomains!.includes(eid.split('.')[0]));
      }

      if (entityFilter) {
        conditions.push((eid) => hass.states[eid] && entityFilter(hass.states[eid]));
      }

      const entityIds = _arrayFilter(entities, conditions, maxEntities);

      if (entityIds.length < maxEntities && entitiesFallback.length) {
        const fallbackEntityIds = _findEntities(
          hass,
          maxEntities - entityIds.length,
          entitiesFallback,
          [],
          includeDomains,
          entityFilter,
        );

        entityIds.push(...fallbackEntityIds);
      }

      return entityIds;
    };

    //build a valid stub config

    let includeDomains = ['binary_sensor'];
    let maxEntities = 2;

    let foundEntities = _findEntities(hass, maxEntities, entities, entitiesFallback, includeDomains);


    const url = new URL(import.meta.url);
    let asset = url.pathname.split("/").pop();
    let path = url.pathname.replace(asset, "");

    if (path.includes("hacsfiles")) {

      path = "/local/community/floor3d-card/";

    }

    const conf = {
      path: path,
      name: "Home",
      objfile: "home.glb",
      shadow: "yes",
      globalLightPower: "0.8",
      header: "no",
      camera_position: { x: 609.3072605703628, y: 905.5330092468828, z: 376.66437610591277 },
      camera_rotate: { x: -1.0930244719682243, y: 0.5200808414019678, z: 0.7648717152512469 },
      camera_target: { x: 37.36890424945437, y: 18.64464320782064, z: -82.55051697031719 },
      object_groups: [{ object_group: "RoundTable", objects: [{object_id: "Round_table_1"}, {object_id: "Round_table_2"}, {object_id: "Round_table_3"} ]},
      { object_group: "EntranceDoor", objects: [{object_id: "Door_9"}, {object_id: "Door_7"}, {object_id: "Door_5"} ]} ],
      entities: []
    };


    let totalentities = 0;

    if (foundEntities[0]) {
      conf.entities.push( {
        entity: foundEntities[0],
        type3d: "door",
        object_id: "<EntranceDoor>",
        door:
        {  doortype: "swing",
          direction: "inner",
          hinge: "Door_3",
          percentage: "90"}
      });
      totalentities += 1;
    }
    if (foundEntities[1]) {
        conf.entities.push( {
        entity: foundEntities[1],
        type3d: "hide",
        object_id: "<RoundTable>",
        hide:
        {  state: "off" }
      });
      totalentities += 1;
    }

    includeDomains = ["light"];
    maxEntities = 1;

    let foundLights = _findEntities(hass, maxEntities, entities, entitiesFallback, includeDomains);

    if (foundLights[0]) {
      conf.entities.push(
        {
          entity: foundLights[0],
          type3d: "light",
          object_id: "Bowl_2",
          light:
        {  lumens: "800" }
        }
      );
      totalentities += 1;
    }

    if (totalentities == 0) {
      conf.entities.push(
        {
          entity: ""
        }
      );

    }

    console.log(conf);

    console.log("Stub ended");
    return conf;
  }


  // TODO Add any properities that should cause your element to re-render here
  // https://lit-element.polymer-project.org/guide/properties
  //@property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: Floor3dCardConfig;

  // https://lit-element.polymer-project.org/guide/properties#accessors-custom
  public setConfig(config: Floor3dCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    console.log('floor3d-card: Set Config Start');

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

    console.log('floor3d-card: Set Config End');

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
    this._content.removeEventListener('keydown', this._performActionListener);
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
        const show_header = this._config.header ? this._config.header : 'yes';

        if (show_header == 'yes') {
          (this._card as any).header = this._config.name ? this._config.name : 'Floor 3d';
        } else {
          (this._card as any).header = '';
        }
      }

      if (this._content && !this._renderer) {
        this.display3dmodel();
      }

      console.log('First updated end');
    }
  }

  private _render(): void {
    //render the model
    if (this._torch) {
      this._torch.position.copy(this._camera.position);
      this._torch.rotation.copy(this._camera.rotation);
      this._camera.getWorldDirection(this._torch.target.position);
      //console.log(this._renderer.info);
    }
    this._renderer.render(this._scene, this._camera);
  }

  private _getintersect(e: any): THREE.Intersection[] {
    const mouse: THREE.Vector2 = new THREE.Vector2();
    mouse.x = (e.offsetX / this._content.clientWidth) * 2 - 1;
    mouse.y = -(e.offsetY / this._content.clientHeight) * 2 + 1;
    const raycaster: THREE.Raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);
    const intersects: THREE.Intersection[] = raycaster.intersectObjects(this._raycasting, false);
    return intersects;
  }

  private _firevent(e: any): void {
    //double click on object to show the name
    const intersects = this._getintersect(e);
    if (intersects.length > 0 && intersects[0].object.name != '') {
      this._config.entities.forEach((entity, i) => {
        for (let j = 0; j < this._object_ids[i].objects.length; j++) {
          if (this._object_ids[i].objects[j].object_id == intersects[0].object.name) {
            if (this._config.entities[i].action) {
              switch (this._config.entities[i].action) {
                case 'more-info':
                  fireEvent(this, 'hass-more-info', { entityId: entity.entity });
                  break;
                case 'overlay':
                  if (this._overlay) {
                    this._setoverlaycontent(entity.entity);
                  }
                  break;
                case 'default':
                default:
                  this._defaultaction(intersects);
              }
              return;
            } else {
              this._defaultaction(intersects);
              return;
            }
          }
        }
      });
    }
  }

  private _setoverlaycontent(entity_id: string): void {
    this._overlay_entity = entity_id;
    const name = this._hass.states[entity_id].attributes['friendly_name']
      ? this._hass.states[entity_id].attributes['friendly_name']
      : entity_id;
    this._overlay.textContent = name + ': ' + this._hass.states[entity_id].state;
    this._overlay_state = this._hass.states[entity_id].state;
  }

  private _defaultaction(intersects: THREE.Intersection[]): void {
    if (intersects.length > 0 && intersects[0].object.name != '') {
      if (getLovelace().editMode) {
        window.prompt('Object:', intersects[0].object.name);
      } else {
        this._config.entities.forEach((entity, i) => {
          if (entity.type3d == 'light' || entity.type3d == 'gesture' || entity.type3d == 'camera') {
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
                } else if (entity.type3d == 'camera') {
                  fireEvent(this, 'hass-more-info', { entityId: entity.entity });
                  //this._hass.states[entity.entity].attributes["entity_picture"]
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
          ' }\n' +
          'camera_target: { x: ' +
          this._controls.target.x +
          ', y: ' +
          this._controls.target.y +
          ', z: ' +
          this._controls.target.z +
          ' }',
      );
    }
  }

  private _performAction(e: any): void {
    const intersects = this._getintersect(e);
    this._defaultaction(intersects);
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
            console.log('Canvas Obscured; stopping animation');
            this._clock = null;
            this._renderer.setAnimationLoop(null);
          }
        }
      } else {
        if (this._cardObscured) {
          this._cardObscured = false;

          if (this._to_animate) {
            console.log('Canvas visible again; starting animation');
            this._clock = new THREE.Clock();
            this._renderer.setAnimationLoop(() => this._rotateobjects());
          }
        }
      }
    }
  }

  private _getZIndex(toCheck: any): string {
    let returnVal: string;

    if (toCheck == null) {
      returnVal = '0';
    }

    if (toCheck.parentNode == null) {
      return '0';
    }

    returnVal = getComputedStyle(toCheck).getPropertyValue('--dialog-z-index');
    if (returnVal == '') {
      returnVal = getComputedStyle(toCheck).getPropertyValue('z-index');
    }

    if (returnVal == '' || returnVal == 'auto') {
      if (toCheck.parentNode.constructor != null) {
        if (toCheck.parentNode.constructor.name == 'ShadowRoot') {
          return this._getZIndex(toCheck.parentNode.host);
        } else if (toCheck.parentNode.constructor.name == 'HTMLDocument') {
          return '0';
        } else {
          return this._getZIndex(toCheck.parentNode);
        }
      } else {
        returnVal = '0';
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
        this._rooms = [];
        this._sprites = [];
        this._canvas = [];
        this._text = [];
        this._spritetext = [];
        this._position = [];

        this._config.entities.forEach((entity) => {
          if (hass.states[entity.entity]) {
            this._states.push(this._statewithtemplate(entity));
            this._canvas.push(null);
            if (hass.states[entity.entity].attributes['unit_of_measurement']) {
              this._unit_of_measurement.push(hass.states[entity.entity].attributes['unit_of_measurement']);
            } else {
              this._unit_of_measurement.push('');
            }
            if (entity.type3d == 'text') {
              if (entity.text.attribute) {
                if (hass.states[entity.entity].attributes[entity.text.attribute]) {
                  this._text.push(hass.states[entity.entity].attributes[entity.text.attribute]);
                } else {
                  this._text.push(this._statewithtemplate(entity));
                }
              } else {
                this._text.push(this._statewithtemplate(entity));
              }
            } else {
              this._text.push('');
            }
            if (entity.type3d == 'room') {
              this._rooms.push(entity.object_id + '_room');
              this._sprites.push(entity.object_id + '_sprites');
              if (entity.room.attribute) {
                if (hass.states[entity.entity].attributes[entity.room.attribute]) {
                  this._spritetext.push(hass.states[entity.entity].attributes[entity.room.attribute]);
                } else {
                  this._spritetext.push(this._statewithtemplate(entity));
                }
              } else {
                if (entity.room.label_text) {
                  if (entity.room.label_text == 'template') {
                    this._spritetext.push(this._statewithtemplate(entity));
                    this._unit_of_measurement.pop();
                    this._unit_of_measurement.push('');
                  } else {
                    this._spritetext.push(this._hass.states[entity.entity].state);
                  }
                }
              }
            } else {
              this._spritetext.push('');
              this._rooms.push('');
              this._sprites.push('');
            }
            if (entity.type3d == 'cover') {
              if (hass.states[entity.entity].attributes['current_position']) {
                this._position.push(hass.states[entity.entity].attributes['current_position']);
              } else {
                this._position.push(null);
              }
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
          } else
          {
            console.log("Entity <" + entity.entity + "> not found");
          }
        });
        this._firstcall = false;
      }

      if (this._renderer && this._modelready) {
        let torerender = false;
        if (this._config.overlay) {
          if (this._config.overlay == 'yes') {
            if (this._overlay_entity) {
              if (this._overlay_state) {
                if (this._overlay_state != hass.states[this._overlay_entity].state) {
                  this._setoverlaycontent(this._overlay_entity);
                }
              }
            }
          }
        }
        this._config.entities.forEach((entity, i) => {
          if (hass.states[entity.entity]) {
            let state = this._statewithtemplate(entity);
            if (entity.type3d == 'cover') {
              let toupdate = false;
              if (hass.states[entity.entity].attributes['current_position']) {
                if (this._position[i] != hass.states[entity.entity].attributes['current_position']) {
                  this._position[i] = hass.states[entity.entity].attributes['current_position'];
                  toupdate = true;
                }
              } else {
                if (state != this._states[i]) {
                  toupdate = true;
                  this._states[i] = state;
                }
              }
              if (toupdate) {
                this._updatecover(entity, this._states[i], i);
                torerender = true;
              }
            }
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
              } else if (entity.type3d == 'room') {
                let toupdate = false;
                if (entity.room.attribute) {
                  if (hass.states[entity.entity].attributes[entity.room.attribute]) {
                    if (this._spritetext[i] != hass.states[entity.entity].attributes[entity.room.attribute]) {
                      this._spritetext[i] = hass.states[entity.entity].attributes[entity.room.attribute];
                      toupdate = true;
                    }
                  } else {
                    this._spritetext[i] = '';
                    toupdate = true;
                  }
                } else {
                  if (entity.room.label_text) {
                    if (entity.room.label_text == 'template') {
                      if (this._spritetext[i] != this._statewithtemplate(entity)) {
                        this._spritetext[i] = this._statewithtemplate(entity);
                        toupdate = true;
                      }
                    } else {
                      if (this._spritetext[i] != this._states[i]) {
                        this._spritetext[i] = this._states[i];
                        toupdate = true;
                      }
                    }
                  }
                }

                if (this._canvas[i] && toupdate) {
                  this._updateroom(entity, this._spritetext[i], this._unit_of_measurement[i], i);
                  this._updateroomcolor(entity, i);
                  torerender = true;
                }
              }
            }
          }
          else {
            console.log("Entity <" + entity.entity + "> not found");
          }
        });
        if (torerender) {
          this._render();
        }
      }
    }
  }

  private _initSky(): void {
    const effectController = {
      turbidity: 10,
      rayleigh: 3,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.7,
      elevation: 15,
      azimuth: 0,
    };

    //init sky
    console.log('Init Sky');

    this._sky = new Sky();
    this._sky.scale.setScalar(100000);
    this._scene.add(this._sky);

    const uniforms = this._sky.material.uniforms;
    uniforms['turbidity'].value = effectController.turbidity;
    uniforms['rayleigh'].value = effectController.rayleigh;
    uniforms['mieCoefficient'].value = effectController.mieCoefficient;
    uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

    // init ground

    console.log('Init Ground');

    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    groundMat.color.setHSL(0.095, 1, 0.75);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -5;
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    ground.castShadow = false;
    //this._bboxmodel.add(ground);
    this._scene.add(ground);

    // inti sun

    console.log('Init Sun');

    this._sun = new THREE.DirectionalLight(0xffffff, 2.0);
    const sun = new THREE.Vector3();
    this._scene.add(this._sun);

    if (this._hass.states['sun.sun'].attributes['azimuth']) {
      effectController.azimuth = Number(this._hass.states['sun.sun'].attributes['azimuth']);
    }

    if (this._hass.states['sun.sun'].attributes['elevation']) {
      effectController.elevation = Number(this._hass.states['sun.sun'].attributes['elevation']);
    }

    let south: THREE.Vector3;

    south = new THREE.Vector3();

    if (this._config.north) {
      south.x = -this._config.north.x;
      south.z = -this._config.north.z;
      south.y = 0;
    } else {
      south.x = 0;
      south.z = 1;
      south.y = 0;
    }

    let south_sphere: THREE.Spherical;

    south_sphere = new THREE.Spherical();

    south_sphere.setFromVector3(south);

    south_sphere.phi = THREE.MathUtils.degToRad(90 - effectController.elevation);

    south_sphere.theta = THREE.MathUtils.degToRad(
      THREE.MathUtils.radToDeg(south_sphere.theta) - effectController.azimuth,
    );

    sun.setFromSphericalCoords(1, south_sphere.phi, south_sphere.theta);

    if (sun.y < 0) {
      this._sun.intensity = 0;
    }

    uniforms['sunPosition'].value.copy(sun);

    this._sun.position.copy(sun.multiplyScalar(5000));

    // sun directional light parameters
    const d = 1000;

    this._sun.shadow.camera;
    this._sun.castShadow = true;

    this._sun.shadow.mapSize.width = 1024;
    this._sun.shadow.mapSize.height = 1024;
    this._sun.shadow.camera.near = 4000;
    this._sun.shadow.camera.far = 6000;

    this._sun.shadow.camera.left = -d;
    this._sun.shadow.camera.right = d;
    this._sun.shadow.camera.top = d;
    this._sun.shadow.camera.bottom = -d;

    this._renderer.shadowMap.needsUpdate = true;

    //FOR DEBUG: this._scene.add(new THREE.CameraHelper(this._sun.shadow.camera));
  }

  private _initTorch(): void {

    this._torch = new THREE.DirectionalLight(0xffffff, 0.2);
    this._torchTarget = new THREE.Object3D();
    this._torchTarget.name = "Torch Target"
    this._torch.target = this._torchTarget;
    this._torch.matrixAutoUpdate = true;
    this._scene.add(this._torch);
    this._scene.add(this._torchTarget);

    this._torch.castShadow = false;

    this._torch.position.copy(this._camera.position);
    this._torch.rotation.copy(this._camera.rotation);
    this._camera.getWorldDirection(this._torch.target.position);

    if (this._hass.states[this._config.globalLightPower]) {
      if (!Number.isNaN(this._hass.states[this._config.globalLightPower].state)) {
        this._torch.intensity = Number(this._hass.states[this._config.globalLightPower].state);
      }
    } else {
      if (this._config.globalLightPower) {
        this._torch.intensity = Number(this._config.globalLightPower);
      }
    }
  }

  private _initAmbient(): void {


    let intensity = 0.5;

    if (this._hass.states[this._config.globalLightPower]) {
      if (!Number.isNaN(this._hass.states[this._config.globalLightPower].state)) {
        intensity = Number(this._hass.states[this._config.globalLightPower].state);
      }
    } else {
      if (this._config.globalLightPower) {
        intensity = Number(this._config.globalLightPower);
      }
    }

    if (this._config.sky == 'yes') {
      this._ambient_light = new THREE.HemisphereLight(0xffffff, 0x000000, 0.2);
      this._ambient_light.groundColor.setHSL(0.095, 1, 0.75);
      this._ambient_light.intensity = intensity;
    } else {
      this._ambient_light = new THREE.AmbientLight(0xffffff, 0.2);
      this._ambient_light.intensity = intensity;
    }

    this._scene.add(this._ambient_light);

  }

  protected display3dmodel(): void {
    //load the model into the GL Renderer

    console.log('Start Build Renderer');
    this._modelready = false;

    //create and initialize scene and camera

    this._scene = new THREE.Scene();

    this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);

    // create and initialize renderer

    this._renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, alpha: true });
    this._maxtextureimage = this._renderer.capabilities.maxTextures;
    console.log('Max Texture Image Units: ' + this._maxtextureimage);
    console.log('Max Texture Image Units: number of lights casting shadow should be less than the above number');

    const availableshadows = Math.max(6, this._maxtextureimage - 4);

    this._renderer.domElement.style.width = '100%';
    this._renderer.domElement.style.height = '100%';
    this._renderer.domElement.style.display = 'block';

    if (this._config.backgroundColor) {
      if (this._config.backgroundColor == 'transparent') {
        this._renderer.setClearColor(0x000000, 0);
      } else {
        this._scene.background = new THREE.Color(this._config.backgroundColor);
      }
    } else {
      this._scene.background = new THREE.Color('#aaaaaa');
    }


    //this._renderer.physicallyCorrectLights = true;
    if (this._config.sky && this._config.sky == 'yes') {
        this._renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this._renderer.toneMapping = THREE.LinearToneMapping;
    //this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 0.6;
    this._renderer.localClippingEnabled = true;
    this._renderer.physicallyCorrectLights = false;


    if (this._config.path && this._config.path != '') {
      let path = this._config.path;
      const lastChar = path.charAt(path.length - 1);
      if (lastChar == '.') {
        path = '';
      } else if (lastChar != '/') {
        path = path + '/';
      }
      console.log('Path: ' + path);


      let fileExt = this._config.objfile.split('?')[0].split('.').pop();

      if (fileExt == 'obj') {
        //waterfront format
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
        this._modeltype = ModelSource.OBJ;
      } else if (fileExt == "glb") {
        //glb format
        const loader = new GLTFLoader().setPath( path );
        loader.load(
          this._config.objfile,
          this._onLoadedGLTF3DModel.bind(this),
          this._onloadedGLTF3DProgress.bind(this),
          function (error: ErrorEvent): void {
            throw new Error(error.error);
          },
        );
        this._modeltype = ModelSource.GLB;

      }
    } else {
      throw new Error('Path is empty');
    }
    console.log('End Build Renderer');
  }

  private _onLoadError(event: ErrorEvent): void {
    this._showError(event.error);
  }

  private _onloadedGLTF3DProgress(_progress: ProgressEvent): void {

    this._content.innerText = 'Loading: ' + Math.round((_progress.loaded / _progress.total) * 100) + '%';

  }


  private _onLoadMaterialProgress(_progress: ProgressEvent): void {
    //progress function called at regular intervals during material loading process
    this._content.innerText = '1/2: ' + Math.round((_progress.loaded / _progress.total) * 100) + '%';

  }

  private _onLoadObjectProgress(_progress: ProgressEvent): void {
    //progress function called at regular intervals during object loading process
    this._content.innerText = '2/2: ' + Math.round((_progress.loaded / _progress.total) * 100) + '%';

  }

  private _onLoadedGLTF3DModel(gltf: GLTF) {

    this._onLoaded3DModel(gltf.scene);

  }

  private _onLoaded3DModel(object: Object3D): void {
    // Object Loaded Event: last root object passed to the function

    console.log('Object loaded start');

    this._initobjects(object);

    this._bboxmodel = new THREE.Object3D();

    this._levels.forEach((element) => {
      this._bboxmodel.add(element);
    });

    this._scene.add(this._bboxmodel);

    this._bboxmodel.updateMatrixWorld(true);


    this._content.innerText = 'Finished with errors: check the console log';

    if (this._config.show_axes) {
      if (this._config.show_axes == 'yes') {
        this._scene.add(new THREE.AxesHelper(300));
      }
    }

    if (this._config.shadow && this._config.shadow == 'yes') {
      console.log('Shadow On');
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this._renderer.shadowMap.autoUpdate = false;
    } else {
      console.log('Shadow Off');
      this._renderer.shadowMap.enabled = false;
    }

    this._add3dObjects();

    console.log('Object loaded end');

    if (this._content && this._renderer) {
      this._modelready = true;
      console.log('Show canvas');
      this._levelbar = document.createElement('div');
      this._zoombar = document.createElement('div');
      this._content.innerText = '';
      this._content.appendChild(this._levelbar);
      this._content.appendChild(this._zoombar);
      this._content.appendChild(this._renderer.domElement);
      this._selectedlevel = -1;
      render(this._getLevelBar(), this._levelbar);
      if (this._config.click == 'yes') {
        this._content.addEventListener('click', this._fireventListener);
      }

      this._content.addEventListener('dblclick', this._performActionListener);
      this._content.addEventListener('touchstart', this._performActionListener);
      this._content.addEventListener('keydown', this._performActionListener);

      this._setCamera();

      this._controls = new OrbitControls(this._camera, this._renderer.domElement);

      this._renderer.setPixelRatio(window.devicePixelRatio);

      this._controls.maxPolarAngle = (0.85 * Math.PI) / 2;
      this._controls.addEventListener('change', this._changeListener);

      this._setLookAt();

      this._controls.update();

      if (this._config.lock_camera == 'yes') {
        /*
                this._controls.enableRotate = false;
                this._controls.enableZoom = false;
                this._controls.enablePan = false;
        */
        this._controls.enabled = false;
      }

      if (this._config.sky && this._config.sky == 'yes') {
          this._initSky();
      }

      if (!this._config.sky || this._config.sky == 'no') {
        this._initTorch();
      }

      this._initAmbient();

      this._getOverlay();

      this._manageZoom();

      this._setVisibleLevel(-1);

      this._resizeCanvas();

      /*
      this._zoom.forEach(element => {

        this._bboxmodel.localToWorld(element.position);
        this._bboxmodel.localToWorld(element.target);

      });
      */

      this._zIndexInterval = window.setInterval(() => {
        this._zIndexChecker();
      }, 250);

      if (this._ispanel() || this._issidebar()) {
        this._resizeObserver.observe(this._card);
      }
    }
  }

  private _initobjects(object: THREE.Object3D) {
    console.log('Ïnit Objects, Levels and Raycasting');

    let level = 0;
    this._levels = [];
    this._raycasting = [];
    this._raycastinglevels = [];
    //TODO: explore solution with layers

    console.log('Found level 0');

    this._levels[0] = new THREE.Object3D();
    this._raycastinglevels[0] = [];

    const regex = /lvl(?<level>\d{3})/;

    let imported_objects: THREE.Object3D[] = [];


    object.traverse((element) => {
      imported_objects.push(element);
    });

    imported_objects.forEach((element) => {
      let found;

      found = element.name.match(regex);

      if (found) {
        if (!this._levels[Number(found.groups?.level)]) {
          console.log('Found level ' + found.groups?.level);
          this._levels[Number(found.groups?.level)] = new THREE.Object3D();
          this._raycastinglevels[Number(found.groups?.level)] = [];
        }

        element.userData = { level: Number(found.groups?.level) };
        element.name = element.name.slice(6);
        this._levels[Number(found.groups?.level)].add(element);
        level = Number(found.groups?.level);
      } else {
        element.userData = { level: 0 };
        this._levels[0].add(element);
        level = 0
      }

      element.receiveShadow = true;

      if (element.name.includes('transparent_slab')) {
        element.castShadow = true;
        if ((element as THREE.Mesh).material instanceof THREE.MeshPhongMaterial) {
          ((element as THREE.Mesh).material as THREE.MeshPhongMaterial).depthWrite = false;
        } else if ((element as THREE.Mesh).material instanceof THREE.MeshBasicMaterial) {
          ((element as THREE.Mesh).material as THREE.MeshBasicMaterial).depthWrite = false;
        } else if ((element as THREE.Mesh).material instanceof THREE.MeshStandardMaterial) {
          ((element as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent = true;
          ((element as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0;
          ((element as THREE.Mesh).material as THREE.MeshStandardMaterial).depthWrite = false;
        }
        return;
      }

      if (this._modeltype == ModelSource.GLB) {
        if (element.name.includes('_hole_')) {
          element.castShadow = false;
          if ((element as THREE.Mesh).material instanceof THREE.MeshStandardMaterial) {
            ((element as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent = true;
            ((element as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0;
          }
          return;
        }
      }

      this._raycastinglevels[level].push(element);
      //this._raycasting.push(element);

      if (element instanceof THREE.Mesh) {
        if (!Array.isArray((element as THREE.Mesh).material)) {
          if (((element as THREE.Mesh).material as THREE.Material).opacity != 1) {
            if ((element as THREE.Mesh).material instanceof THREE.MeshPhongMaterial) {
              ((element as THREE.Mesh).material as THREE.MeshPhongMaterial).depthWrite = false;
            } else if ((element as THREE.Mesh).material instanceof THREE.MeshBasicMaterial) {
              ((element as THREE.Mesh).material as THREE.MeshBasicMaterial).depthWrite = false;
            } else if ((element as THREE.Mesh).material instanceof THREE.MeshStandardMaterial) {
              ((element as THREE.Mesh).material as THREE.MeshBasicMaterial).depthWrite = false;
            }
            element.castShadow = false;
            return;
          }
        }
      }

      const shadow = this._config.shadow ? this._config.shadow : 'no';

      if (shadow == 'no') {
        element.castShadow = false;
      } else {
        element.castShadow = true;
      }

      return;
    });

    this._displaylevels = [];
    this._levels.forEach((level, index) => {
      if (level)
      {
        this._displaylevels.push(true);
        this._raycasting = this._raycasting.concat(this._raycastinglevels[index]);
      }
    }
    );
    console.log('End Init Objects. Number of levels found: ' + this._levels.length);
  }

  private _setVisibleLevel(level: number): void {

      this._levels.forEach((element, i) => {
        if (level == -1) {
          element.visible = true;
          this._displaylevels[i] = true;
        }
        if (level == i) {
          element.visible = !element.visible;
          this._displaylevels[level] = !this._displaylevels[level];
        } else {
          element.visible = this._displaylevels[i];
        }
      });

    this._raycasting = [];

    this._displaylevels.forEach((visible, index) => {
      if (visible) {
       this._raycasting = this._raycasting.concat(this._raycastinglevels[index]);
      }
    });
  }

  private _getZoomBar(): TemplateResult {
    if (this._levels) {
      if (this._zoom.length > 0) {
        return html` <div class="category" style="opacity: 0.5; position: absolute; bottom: 0px; left: 0px">${this._getZoomButtons()}</div> `;
      } else {
        return html``;
      }
    } else {
      return html``;
    }
  }

  private _getZoomButtons(): TemplateResult[] {
    const iconArray: TemplateResult[] = [];


    iconArray.push(html`
      <div class="row" style="background-color:black;">
        <font color="white">
        <floor3d-button
          style="opacity: 100%;"
          label="reset"
          .index=${-1}
          @click=${this._handleZoomClick.bind(this)}
        >
        </floor3d-button>
        </font>
      </div>
    `);

    this._zoom.forEach((element, index) => {
      if (element) {
        iconArray.push(html`
          <div class="row" style="background-color:black;">
          <font color="white">
            <floor3d-button
              label=${element.name}
              .index=${index}
              @click=${this._handleZoomClick.bind(this)}
            >
            </floor3d-button>
            </font>
          </div>
        `);
      }
    });

    return iconArray;
  }


  private _getLevelBar(): TemplateResult {
    if (this._levels) {
      if (this._levels.length > 1 && this._config.hideLevelsMenu == "no") {
        return html` <div class="category" style="opacity: 0.5; position: absolute">${this._getLevelIcons()}</div> `;
      } else {
        return html``;
      }
    } else {
      return html``;
    }
  }

  private _getLevelIcons(): TemplateResult[] {
    const iconArray: TemplateResult[] = [];


    iconArray.push(html`
      <div class="row" style="background-color:black;">
        <font color="white">
        <ha-icon
          .icon=${`mdi:format-list-numbered`}
          style="opacity: 100%;"
          class="ha-icon-large"
          .index=${-1}
          @click=${this._handleLevelClick.bind(this)}
        >
        </ha-icon>
        </font>
      </div>
    `);

    this._levels.forEach((element, index) => {
      if (element) {
        iconArray.push(html`
          <div class="row" style="background-color:black;">
          <font color="white">
            <ha-icon
              .icon=${`mdi:numeric-${index}-box-multiple`}
              style=${ this._displaylevels[index] ? 'opacity: 100%;' : 'opacity: 60%;'}
              class="ha-icon-large"
              .index=${index}
              @click=${this._handleLevelClick.bind(this)}
            >
            </ha-icon>
            </font>
          </div>
        `);
      }
    });

    return iconArray;
  }

  private _handleZoomClick(ev): void {

    if (ev.target.index == -1) {

      this._setCamera();

      this._setLookAt();

      this._controls.update();

      this._render();

      return;

    }

    this._camera.position.set(
        this._zoom[ev.target.index].position.x,
        this._zoom[ev.target.index].position.y,
        this._zoom[ev.target.index].position.z,
    );

    this._camera.rotation.set(
      this._zoom[ev.target.index].rotation.x,
      this._zoom[ev.target.index].rotation.y,
      this._zoom[ev.target.index].rotation.z,
    );

    this._controls.target.set(
      this._zoom[ev.target.index].target.x,
      this._zoom[ev.target.index].target.y,
      this._zoom[ev.target.index].target.z
    );

    this._camera.updateProjectionMatrix();

    this._controls.update();

    this._render();

  }

  private _handleLevelClick(ev): void {

    this._setVisibleLevel(ev.target.index);

    render(this._getLevelBar(), this._levelbar);

    this._render();

  }

  private _getOverlay(): void {
    if (this._config.overlay == 'yes') {
      console.log('Start config Overlay');
      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      overlay.className = 'overlay';
      overlay.style.setProperty('position', 'absolute');
      if (this._config.overlay_alignment) {
        switch (this._config.overlay_alignment) {
          case 'top-left':
            overlay.style.setProperty('top', '0px');
            overlay.style.setProperty('left', '0px');
            break;
          case 'top-right':
            overlay.style.setProperty('top', '0px');
            overlay.style.setProperty('right', '0px');
            break;
          case 'bottom-left':
            overlay.style.setProperty('bottom', '0px');
            overlay.style.setProperty('left', '0px');
            break;
          case 'bottom-right':
            overlay.style.setProperty('bottom', '0px');
            overlay.style.setProperty('right', '0px');
            break;
          default:
            overlay.style.setProperty('top', '0px');
            overlay.style.setProperty('left', '0px');
        }
      }
      if (this._config.overlay_width) {
        overlay.style.setProperty('width', this._config.overlay_width + '%');
      } else {
        overlay.style.setProperty('width', '33%');
      }
      if (this._config.overlay_height) {
        overlay.style.setProperty('height', this._config.overlay_height + '%');
      } else {
        overlay.style.setProperty('height', '20%');
      }

      if (this._config.overlay_bgcolor) {
        overlay.style.setProperty('background-color', this._config.overlay_bgcolor);
      } else {
        overlay.style.setProperty('background-color', 'transparent');
      }
      if (this._config.overlay_fgcolor) {
        overlay.style.setProperty('color', this._config.overlay_fgcolor);
      } else {
        overlay.style.setProperty('color', 'black');
      }
      if (this._config.overlay_font) {
        overlay.style.fontFamily = this._config.overlay_font;
      }
      if (this._config.overlay_fontsize) {
        overlay.style.fontSize = this._config.overlay_fontsize;
      }

      overlay.style.setProperty('overflow', 'hidden');
      overlay.style.setProperty('white-space', 'nowrap');
      let zindex = '';

      try {
        zindex = this._getZIndex(this._renderer.domElement.parentNode);
      } catch (error) {
        console.log(error);
      }

      if (zindex) {
        overlay.style.setProperty('z-index', (Number(zindex) + 1).toString(10));
      } else {
        overlay.style.setProperty('z-index', '999');
      }

      (this._renderer.domElement.parentNode as HTMLElement).style.setProperty('position', 'relative');
      this._renderer.domElement.parentNode.appendChild(overlay);
      this._overlay = overlay;
      console.log('End config Overlay');
    }
  }

  private _setCamera(): void {
    const box: THREE.Box3 = new THREE.Box3().setFromObject(this._bboxmodel);

    this._modelX = this._bboxmodel.position.x = -(box.max.x - box.min.x) / 2;
    this._modelY = this._bboxmodel.position.y = -box.min.y;
    this._modelZ = this._bboxmodel.position.z = -(box.max.z - box.min.z) / 2;

    if (this._config.camera_position) {
      this._camera.position.set(
        this._config.camera_position.x,
        this._config.camera_position.y,
        this._config.camera_position.z,
      );
    } else {
      this._camera.position.set(box.max.x * 1.3, box.max.y * 5, box.max.z * 1.3);
    }

    if (this._config.camera_rotate) {
      this._camera.rotation.set(
        this._config.camera_rotate.x,
        this._config.camera_rotate.y,
        this._config.camera_rotate.z,
      );
    } else {
      this._camera.rotation.set(0, 0, 0);
    }

    this._camera.updateProjectionMatrix();
  }

  private _setLookAt(): void {
    const box: THREE.Box3 = new THREE.Box3().setFromObject(this._bboxmodel);

    if (this._config.camera_target) {
      this._controls.target.set(
        this._config.camera_target.x,
        this._config.camera_target.y,
        this._config.camera_target.z,
      );
    } else {
      this._camera.lookAt(box.max.multiplyScalar(0.5));
    }
    this._camera.updateProjectionMatrix();
  }

  private _setNoShadowLight(object: THREE.Object3D): void {
    object.receiveShadow = true;
    object.castShadow = false;

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
      this._zoom = [];

      this._config.entities.forEach((entity, i) => {
        try {
          this._objposition.push([0, 0, 0]);
          this._pivot.push(null);
          this._axis_for_door.push(null);
          this._degrees.push(0);
          this._slidingdoor.push(null);
          this._slidingdoorposition.push([]);
          if (this._hass.states[entity.entity]) {
            if (entity.type3d == 'rotate') {
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
              this._pivot[i] = new THREE.Vector3();
              this._pivot[i].subVectors(bbox.max, bbox.min).multiplyScalar(0.5);
              this._pivot[i].add(bbox.min);

              this._object_ids[i].objects.forEach((element) => {
                let _obj: any = this._scene.getObjectByName(element.object_id);
                this._centerobjecttopivot(_obj, this._pivot[i]);
                _obj.geometry.applyMatrix4(
                  new THREE.Matrix4().makeTranslation(-this._pivot[i].x, -this._pivot[i].y, -this._pivot[i].z),
                );
              });
            }
            if (entity.type3d == 'door') {
              if (entity.door.doortype == 'swing') {
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
                      case 'up':
                        position.x = position.x / 2;
                        position.z = position.z / 2;
                        position.y = position.y;
                        if (position.x > position.z) {
                          this._axis_for_door[i] = new THREE.Vector3(1, 0, 0);
                        } else {
                          this._axis_for_door[i] = new THREE.Vector3(0, 0, 1);
                        }
                        break;
                      case 'down':
                        position.x = position.x / 2;
                        position.z = position.z / 2;
                        position.y = 0;
                        if (position.x > position.z) {
                          this._axis_for_door[i] = new THREE.Vector3(1, 0, 0);
                        } else {
                          this._axis_for_door[i] = new THREE.Vector3(0, 0, 1);
                        }
                        break;
                      case 'left':
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
                      case 'right':
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
                this._degrees[i] = entity.door.degrees ? entity.door.degrees : 90;
                this._object_ids[i].objects.forEach((element) => {
                  let _obj: any = this._scene.getObjectByName(element.object_id);

                  this._centerobjecttopivot(_obj, this._pivot[i]);

                  _obj.geometry.applyMatrix4(
                    new THREE.Matrix4().makeTranslation(-this._pivot[i].x, -this._pivot[i].y, -this._pivot[i].z),
                  );
                });

                //console.log("End Add Door Swing");
              } else if (entity.door.doortype == 'slide') {
                //console.log("Start Add Door Slide");

                this._object_ids[i].objects.forEach((element) => {
                  let _obj: any = this._scene.getObjectByName(element.object_id);
                  let objbbox = new THREE.Box3().setFromObject(_obj);
                  this._slidingdoorposition[i].push(objbbox.min);
                  this._centerobjecttopivot(_obj, objbbox.min);
                  _obj.geometry.applyMatrix4(
                    new THREE.Matrix4().makeTranslation(-objbbox.min.x, -objbbox.min.y, -objbbox.min.z),
                  );
                });

                //console.log("End Add Door Slide");
              }
            }
            if (entity.type3d == 'cover') {
              const pane: THREE.Mesh = this._scene.getObjectByName(entity.cover.pane) as THREE.Mesh;

              if (pane) {
                this._object_ids[i].objects.forEach((element) => {
                  let _obj: any = this._scene.getObjectByName(element.object_id);
                  let objbbox = new THREE.Box3().setFromObject(_obj);
                  this._slidingdoorposition[i].push(objbbox.min);
                  this._centerobjecttopivot(_obj, objbbox.min);
                  _obj.geometry.applyMatrix4(
                    new THREE.Matrix4().makeTranslation(-objbbox.min.x, -objbbox.min.y, -objbbox.min.z),
                  );
                });

                let boxpane: THREE.Box3 = new THREE.Box3().setFromObject(pane);

                let panevertices: THREE.Vector3[] = [];

                switch (entity.cover.side) {
                  case 'up':
                    panevertices = [
                      new THREE.Vector3(boxpane.min.x, boxpane.max.y, boxpane.min.z), // 000
                      new THREE.Vector3(boxpane.min.x, boxpane.max.y, boxpane.max.z), // 001
                      new THREE.Vector3(boxpane.max.x, boxpane.max.y, boxpane.min.z), // 010
                      new THREE.Vector3(boxpane.max.x, boxpane.max.y, boxpane.max.z), // 011
                    ];
                    break;
                  case 'down':
                    panevertices = [
                      new THREE.Vector3(boxpane.min.x, boxpane.min.y, boxpane.min.z), // 000
                      new THREE.Vector3(boxpane.min.x, boxpane.min.y, boxpane.max.z), // 001
                      new THREE.Vector3(boxpane.max.x, boxpane.min.y, boxpane.min.z), // 010
                      new THREE.Vector3(boxpane.max.x, boxpane.min.y, boxpane.max.z), // 011
                    ];
                    break;
                }

                panevertices.sort((firstel, secondel) => {
                  if (firstel.x < secondel.x) {
                    return -1;
                  }
                  if (firstel.x > secondel.x) {
                    return 1;
                  }
                  return 0;
                });

                const coverplane = new THREE.Plane();

                coverplane.setFromCoplanarPoints(panevertices[2], panevertices[1], panevertices[0]);

                const clipPlanes = [coverplane];

                this._object_ids[i].objects.forEach((element) => {
                  let _obj: any = this._scene.getObjectByName(element.object_id);
                  (_obj.material as THREE.Material).clippingPlanes = clipPlanes;
                });

                //(pane.material as THREE.Material).clippingPlanes = clipPlanes;

                if (this._config.shadow) {
                  if (this._config.shadow == 'yes') {
                    (pane.material as THREE.Material).clipShadows = true;
                  } else {
                    (pane.material as THREE.Material).clipShadows = false;
                  }
                }

                //const planehelper = new THREE.PlaneHelper(coverplane, 200);
                //this._scene.add(planehelper);

                this._updatecover(entity, this._states[i], i);
              }
            }
            if (entity.type3d == 'light') {
              // Add Virtual Light Objects
              this._object_ids[i].objects.forEach((element) => {
                const _foundobject: any = this._scene.getObjectByName(element.object_id);
                if (_foundobject) {
                  const box: THREE.Box3 = new THREE.Box3();
                  box.setFromObject(_foundobject);

                  let light = new THREE.Light();

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

                  let decay: number;
                  let distance: number;

                  if (entity.light.decay) {
                    decay = Number(entity.light.decay);
                  } else {
                    decay = 2;
                  }

                  if (entity.light.distance) {
                    distance = Number(entity.light.distance);
                  } else {
                    distance = 600;
                  }

                  if (entity.light.light_target || entity.light.light_direction) {
                    const angle = entity.light.angle ? THREE.MathUtils.degToRad(entity.light.angle) : Math.PI / 10;

                    const slight: THREE.SpotLight = new THREE.SpotLight(
                      new THREE.Color('#ffffff'),
                      0,
                      distance,
                      angle,
                      0.5,
                      decay,
                    );
                    //this._bboxmodel.add(slight);
                    this._levels[_foundobject.userData.level].add(slight);
                    let target = new THREE.Object3D();
                    //this._bboxmodel.add(target);
                    this._levels[_foundobject.userData.level].add(target);
                    slight.position.set(x, y, z);
                    if (entity.light.light_direction) {
                      target.position.set(
                        x + entity.light.light_direction.x,
                        y + entity.light.light_direction.y,
                        z + entity.light.light_direction.z,
                      );
                    } else {
                      const tobj: THREE.Object3D = this._scene.getObjectByName(entity.light.light_target);

                      if (tobj) {
                        const tbox: THREE.Box3 = new THREE.Box3();
                        tbox.setFromObject(tobj);

                        let tx: number, ty: number, tz: number;

                        tx = (tbox.max.x - tbox.min.x) / 2 + tbox.min.x;
                        tz = (tbox.max.z - tbox.min.z) / 2 + tbox.min.z;
                        ty = (tbox.max.y - tbox.min.y) / 2 + tbox.min.y;

                        target.position.set(tx, ty, tz);
                      }
                    }

                    if (target) {
                      slight.target = target;
                    }

                    light = slight;
                  } else {
                    const plight: THREE.PointLight = new THREE.PointLight(new THREE.Color('#ffffff'), 0, distance, decay);
                    this._levels[_foundobject.userData.level].add(plight);
                    plight.position.set(x, y, z);
                    light = plight;
                  }

                  this._setNoShadowLight(_foundobject);
                  _foundobject.traverseAncestors(this._setNoShadowLight.bind(this));

                  if (entity.light.shadow == 'no') {
                    light.castShadow = false;
                  } else {
                    light.castShadow = true;
                    light.shadow.bias = -0.0001;
                  }
                  light.name = element.object_id + '_light';
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
            if (entity.type3d == 'text') {
              // Clone object to print the text
              this._object_ids[i].objects.forEach((element) => {
                let _foundobject: any = this._scene.getObjectByName(element.object_id);

                let box: THREE.Box3 = new THREE.Box3();
                box.setFromObject(_foundobject);

                let _newobject = _foundobject.clone();

                //(_newobject as Mesh).scale.set(1.005, 1.005, 1.005);
                _newobject.name = 'f3dobj_' + _foundobject.name;
                //this._bboxmodel.add(_newobject);
                this._levels[_foundobject.userData.level].add(_newobject);
              });
            }
          }
        } catch {
          throw new Error("Object issue for Entity: <"+ entity.entity + ">");
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
            this._canvas[i] = this._createTextCanvas(entity.text, this._text[i], this._unit_of_measurement[i]);
            this._updatetext(entity, this._text[i], this._canvas[i], this._unit_of_measurement[i]);
          } else if (entity.type3d == 'rotate') {
            this._rotatecalc(entity, i);
          } else if (entity.type3d == 'room') {
            this._createroom(entity, i);
            this._updateroom(entity, this._spritetext[i], this._unit_of_measurement[i], i);
          }
        }
      });
    }
    console.log('Add 3D Object End');
  }

  // manage all entity types

  private _manageZoom(): void {

    if (this._config.zoom_areas) {

    this._config.zoom_areas.forEach((element) => {

       // For each element of the Zoom Area array calculate zoom position and initialize zoom array

      if (element.object_id && element.object_id != '') {

          let _foundobject: any = this._scene.getObjectByName(element.object_id);

          if (_foundobject && _foundobject instanceof THREE.Mesh) {

            const _targetMesh: THREE.Mesh = _foundobject as THREE.Mesh;
            let targetBox = new THREE.Box3().setFromObject(_targetMesh);

            /*this._centerobjecttopivot(_targetMesh, targetBox.min);
            _targetMesh.geometry.applyMatrix4(
              new THREE.Matrix4().makeTranslation(-targetBox.min.x, -targetBox.min.y, -targetBox.min.z),
            );
            targetBox = new THREE.Box3().setFromObject(_targetMesh);
            */

            let targetVector: THREE.Vector3 = new THREE.Vector3();
            targetVector.addVectors(targetBox.min, targetBox.max.sub(targetBox.min).multiplyScalar(0.5));

            let positionVector: THREE.Vector3;
            if (element.direction) {
              positionVector = new THREE.Vector3(element.direction.x, element.direction.y, element.direction.z);
            }
            else {
              positionVector = new THREE.Vector3(0, 1, 0);
            }
            positionVector.normalize();
            positionVector.multiplyScalar(element.distance ? element.distance : 500);
            positionVector.add(targetVector);

            let rotationVector: THREE.Vector3;
            if (element.rotation) {
              rotationVector = new THREE.Vector3(element.rotation.x, element.rotation.y, element.rotation.z);
            } else {
              rotationVector = new THREE.Vector3(0, 0, 0);
            }

            this._zoom.push(
              {
                "name": element.zoom,
                "target": targetVector,
                "position": positionVector,
                "rotation": rotationVector
              }
            );

          }

        }

      }

    );

    render(this._getZoomBar(), this._zoombar);

    }

  }

  private _createroom(entity: Floor3dCardConfig, i: number): void {
    // createroom

    console.log('Create Room');

    const elevation: number = entity.room.elevation ? entity.room.elevation : 250;
    const transparency: number = entity.room.transparency ? entity.room.transparency : 50;
    const color: string = entity.room.color ? entity.room.color : '#ffffff';

    const _foundroom: THREE.Object3D = this._scene.getObjectByName(entity.object_id);

    if (_foundroom) {
      if (_foundroom.name.includes('room') && _foundroom instanceof THREE.Mesh) {
        const _roomMesh: THREE.Mesh = _foundroom as THREE.Mesh;

        if (_roomMesh.geometry instanceof THREE.BufferGeometry) {

          let oldRoomBox = new THREE.Box3().setFromObject(_roomMesh);
          this._centerobjecttopivot(_roomMesh, oldRoomBox.min);
          _roomMesh.geometry.applyMatrix4(
            new THREE.Matrix4().makeTranslation(-oldRoomBox.min.x, -oldRoomBox.min.y, -oldRoomBox.min.z),
          );

          let newRoomBox: THREE.Box3 = new THREE.Box3().setFromObject(_roomMesh);

          const expansion: THREE.Vector3 = new THREE.Vector3(0, elevation / 2, 0);
          newRoomBox.expandByVector(expansion);

          const dimensions = new THREE.Vector3().subVectors(newRoomBox.max, newRoomBox.min);
          const newRoomGeometry: THREE.BoxBufferGeometry = new THREE.BoxBufferGeometry(
            dimensions.x - 4,
            dimensions.y - 4,
            dimensions.z - 4,
          );

          //const meshPosition = dimensions.addVectors(newRoomBox.min, newRoomBox.max).multiplyScalar(0.5);
          const meshPosition = oldRoomBox.min.clone();
          // move new mesh center so it's aligned with the original object
          meshPosition.y += 2;
          meshPosition.x += 2;
          meshPosition.z += 2;

          //TBD work on position bug
          //const matrixmesh = new THREE.Matrix4().setPosition(meshPosition);
          //newRoomGeometry.applyMatrix4(matrixmesh);

          const newRoomMaterial: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            opacity: 0,
            transparent: true,
          });

          newRoomMaterial.depthWrite = false;
          newRoomMaterial.color.set(new THREE.Color(color));
          newRoomMaterial.emissive.set(new THREE.Color(color));
          newRoomMaterial.opacity = (100 - transparency) / 100;

          newRoomMaterial.needsUpdate = true;

          const newRoomMesh: THREE.Mesh = new THREE.Mesh(newRoomGeometry, newRoomMaterial);

          newRoomMesh.name = this._rooms[i];

          const newSprite: THREE.Sprite = new THREE.Sprite();

          newSprite.name = this._sprites[i];

          this._canvas[i] = this._createTextCanvas(entity.room, this._spritetext[i], this._unit_of_measurement[i]);

          const sprite_width: number = entity.room.width ? entity.room.width : 150;
          const sprite_height: number = entity.room.height ? entity.room.height : 75;
          newSprite.scale.set(sprite_width, sprite_height, 5);

          //TBD work on position bug

          const spritePosition = new THREE.Vector3(
            meshPosition.x + dimensions.x / 2,
            newRoomBox.max.y + elevation / 2 + sprite_height / 2,
            meshPosition.z + dimensions.z / 2,
          );
          newSprite.visible = false;

          if (entity.room.label) {
            if (entity.room.label == 'yes') {
              newSprite.visible = true;
            }
          }

          //this._bboxmodel.add(newSprite);
          this._levels[_roomMesh.userData.level].add(newSprite);
          this._levels[_roomMesh.userData.level].add(newRoomMesh);

          newRoomBox = new THREE.Box3().setFromObject(newRoomMesh);
          this._centerobjecttopivot(newRoomMesh, newRoomBox.min);
          newRoomMesh.geometry.applyMatrix4(
            new THREE.Matrix4().makeTranslation(-newRoomBox.min.x, -newRoomBox.min.y, -newRoomBox.min.z),
          );

          //const matrixsprite = new THREE.Matrix4().setPosition(new THREE.Vector3(meshPosition.x,newRoomBox.max.y+(elevation / 2)+(sprite_height / 2), meshPosition.z));
          //newSprite.applyMatrix4(matrixsprite);

          newRoomMesh.position.set(meshPosition.x, meshPosition.y, meshPosition.z);
          newSprite.position.set(spritePosition.x, spritePosition.y, spritePosition.z);

          this._updateroomcolor(entity, i);
        }
      }
    }

    return;
  }

  private _updateroom(entity: Floor3dCardConfig, text: string, uom: string, i: number): void {
    //update sprite text and other change conditions

    const _roomMesh: THREE.Object3D = this._scene.getObjectByName(this._rooms[i]);
    const _roomSprite: THREE.Object3D = this._scene.getObjectByName(this._sprites[i]);
    const _roomCanvas: HTMLCanvasElement = this._canvas[i];

    if (_roomMesh && entity) {
      let roomsprite: THREE.Sprite = _roomSprite as THREE.Sprite;

      this._updateTextCanvas(entity.room, _roomCanvas, text + uom);

      this._applyTextCanvasSprite(_roomCanvas, roomsprite);
    }
  }

  private _updatecover(item: Floor3dCardConfig, state: string, i: number): void {
    let pane = this._scene.getObjectByName(item.cover.pane);

    if (this._position[i] == null) {
      if (state == 'open') {
        this._position[i] = 100;
      }
      if (state == 'closed') {
        this._position[i] = 0;
      }
    }

    if (!pane) {
      pane = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id);
    }
    this._translatedoor(pane, this._position[i], item.cover.side, i, state);
    this._renderer.shadowMap.needsUpdate = true;
  }

  private _createTextCanvas(entity: Floor3dCardConfig, text: string, uom: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    this._updateTextCanvas(entity, canvas, text + uom);

    return canvas;
  }

  private _updateTextCanvas(entity: Floor3dCardConfig, canvas: HTMLCanvasElement, text: string): void {
    //Manages the update of the text entities according to their configuration and the new text of the entity state

    const ctx = canvas.getContext('2d');

    // Prepare the font to be able to measure
    let fontSize = 56;
    ctx.font = `${fontSize}px ${entity.font ? entity.font : 'monospace'}`;

    const textMetrics = ctx.measureText(text);

    let width = textMetrics.width;
    let height = fontSize;

    let perct = 1.0;
    if (entity.span) {
      perct = parseFloat(entity.span) / 100.0;
    }
    // Resize canvas to match text size

    width = width / perct;
    height = height / perct;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Re-apply font since canvas is resized.
    ctx.font = `${fontSize}px ${entity.font ? entity.font : 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = entity.textbgcolor ? entity.textbgcolor : 'transparent';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = entity.textfgcolor ? entity.textfgcolor : 'white';

    ctx.fillText(text, width / 2, height / 2);
  }

  private _applyTextCanvas(canvas: HTMLCanvasElement, object: THREE.Object3D) {
    // put the canvas texture with the text on top of the generic object: consider merge with the applyTextCanvasSprite
    const _foundobject: any = object;
    let fileExt = this._config.objfile.split('?')[0].split('.').pop();
    
    if (_foundobject instanceof THREE.Mesh) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.repeat.set(1, 1);
      
      if (fileExt == "glb"){ 
        texture.flipY = false;
      }
      if (((_foundobject as THREE.Mesh).material as THREE.MeshBasicMaterial).name.startsWith('f3dmat')) {
        ((_foundobject as THREE.Mesh).material as THREE.MeshBasicMaterial).map = texture;
      } else {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        material.name = 'f3dmat' + _foundobject.name;

        (_foundobject as THREE.Mesh).material = material;
      }
    }
  }

  private _applyTextCanvasSprite(canvas: HTMLCanvasElement, object: THREE.Sprite) {
    // put the canvas texture with the text on top of the Sprite object: consider merge with the applyTextCanvas

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(1, 1);

    if (object.material.name.startsWith('f3dmat')) {
      (object.material as THREE.SpriteMaterial).map = texture;
    } else {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
      material.name = 'f3dmat' + object.name;

      object.material = material;
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
    const _foundobject: any = this._scene.getObjectByName(_item.object_id);

    if (_foundobject) {
      this._updateTextCanvas(_item.text, canvas, state + uom);
      this._applyTextCanvas(canvas, _foundobject);
    }
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
          if (item.light.color) {
            light.color = new THREE.Color(item.light.color);
          } else {
            light.color = new THREE.Color('#ffffff');
          }
        } else {
            light.color = new THREE.Color(this._RGBToHex(this._color[i][0], this._color[i][1], this._color[i][2]));
        }
      } else {
        light.intensity = 0;
        //light.color = new THREE.Color('#000000');
      }
      if (this._config.extralightmode) {
        if (this._config.extralightmode == 'yes') {
          this._manage_light_shadows(item, light);
        }
      }
      this._renderer.shadowMap.needsUpdate = true;
    });
  }

  private _manage_light_shadows(item: Floor3dCardConfig, light: THREE.Light): void {
    if (this._config.shadow == 'yes') {
      if (item.light.shadow == 'yes') {
        if (light.intensity > 0) {
          light.castShadow = true;
        } else {
          light.castShadow = false;
        }
      }
    }
  }

  private _updatedoor(item: Floor3dCardConfig, i: number): void {
    // perform action on door objects

    const _obj: any = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id);

    let door: THREE.Mesh;

    door = _obj;

    if (door) {
      if (item.door.doortype) {
        if (item.door.doortype == 'swing') {
          this._rotatedoorpivot(item, i);
        } else if (item.door.doortype == 'slide') {
          let pane = this._scene.getObjectByName(item.door.pane);
          if (!pane) {
            pane = this._scene.getObjectByName(this._object_ids[i].objects[0].object_id);
          }
          this._translatedoor(
            pane,
            item.door.percentage ? item.door.percentage : 100,
            item.door.side,
            i,
            this._states[i],
          );
        }
      }
    }
    this._renderer.shadowMap.needsUpdate = true;
  }

  private _centerobjecttopivot(object: THREE.Mesh, pivot: THREE.Vector3) {
    //Center a Mesh  along is defined pivot point

    object.applyMatrix4(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    object.position.copy(pivot);
  }

  private _rotatedoorpivot(entity: Floor3dCardConfig, index: number) {
    //For a swing door, rotate the objects along the configured axis and the degrees of opening
    this._object_ids[index].objects.forEach((element) => {
      let _obj: any = this._scene.getObjectByName(element.object_id);

      //this._centerobjecttopivot(_obj, this._pivot[index]);

      if (this._states[index] == 'on') {
        if (entity.door.direction == 'inner') {
          //_obj.rotateOnAxis(this._axis_for_door[index], -Math.PI * this._degrees[index] / 180);

          if (this._axis_for_door[index].y == 1) {
            _obj.rotation.y = (-Math.PI * this._degrees[index]) / 180;
          } else if (this._axis_for_door[index].x == 1) {
            _obj.rotation.x = (-Math.PI * this._degrees[index]) / 180;
          } else if (this._axis_for_door[index].z == 1) {
            _obj.rotation.z = (-Math.PI * this._degrees[index]) / 180;
          }
        } else if (entity.door.direction == 'outer') {
          //_obj.rotateOnAxis(this._axis_for_door[index], Math.PI * this._degrees[index] / 180);
          if (this._axis_for_door[index].y == 1) {
            _obj.rotation.y = (Math.PI * this._degrees[index]) / 180;
          } else if (this._axis_for_door[index].x == 1) {
            _obj.rotation.x = (Math.PI * this._degrees[index]) / 180;
          } else if (this._axis_for_door[index].z == 1) {
            _obj.rotation.z = (Math.PI * this._degrees[index]) / 180;
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
    this._rotation_state[j] = this._states[i] == 'on' ? 1 : 0;

    //If the entity is on and it has the 'percentage' attribute, convert the percentage integer
    //into a decimal and store it as the rotation state
    if (this._rotation_state[j] != 0 && this._hass.states[entity.entity].attributes['percentage']) {
      this._rotation_state[j] = this._hass.states[entity.entity].attributes['percentage'] / 100;
    }

    //If the entity is on and it is reversed, set the rotation state to the negative value of itself
    if (
      this._rotation_state[j] != 0 &&
      this._hass.states[entity.entity].attributes['direction'] &&
      this._hass.states[entity.entity].attributes['direction'] == 'reverse'
    ) {
      this._rotation_state[j] = 0 - this._rotation_state[j];
    }

    //If every rotating entity is stopped, disable animation
    if (this._rotation_state.every((item) => item === 0)) {
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
        this._object_ids[this._rotation_index[index]].objects.forEach((element) => {
          let _obj = this._scene.getObjectByName(element.object_id);
          if (_obj) {
            switch (this._axis_to_rotate[index]) {
              case 'x':
                _obj.rotation.x += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
              case 'y':
                _obj.rotation.y += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
              case 'z':
                _obj.rotation.z += this._round_per_seconds[index] * this._rotation_state[index] * moveBy;
                break;
            }
          }
        });
      }
      this._renderer.shadowMap.needsUpdate = true;
    });

    this._renderer.render(this._scene, this._camera);
  }

  private _translatedoor(pane: THREE.Object3D, percentage: number, side: string, index: number, doorstate: string) {
    //console.log("Translate Door Start");
    //For a slide door, translate the objects according to the configured directions and percentage of opening

    let translate: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    let size: THREE.Vector3 = new THREE.Vector3();
    let center: THREE.Vector3 = new THREE.Vector3();

    //TBD let pane = this._scene.getObjectByName(item.door.pane);

    let bbox = new THREE.Box3().setFromObject(pane);

    size.subVectors(bbox.max, bbox.min);

    this._object_ids[index].objects.forEach((element, j) => {
      let _obj: any = this._scene.getObjectByName(element.object_id);
      _obj.position.set(
        this._slidingdoorposition[index][j].x,
        this._slidingdoorposition[index][j].y,
        this._slidingdoorposition[index][j].z,
      );
    });

    if (doorstate == 'on' || doorstate == 'open') {
      if (side == 'left') {
        if (size.x > size.z) {
          translate.z += 0;
          translate.x += (-size.x * percentage) / 100;
          translate.y = 0;
        } else {
          translate.z += (-size.z * percentage) / 100;
          translate.x += 0;
          translate.y += 0;
        }
      } else if (side == 'right') {
        if (size.x > size.z) {
          translate.z += 0;
          translate.x += (+size.x * percentage) / 100;
          translate.y += 0;
        } else {
          translate.z += (+size.z * percentage) / 100;
          translate.x += 0;
          translate.y += 0;
        }
      } else if (side == 'down') {
        translate.y += (-size.y * percentage) / 100;
        translate.x += 0;
        translate.z += 0;
      } else if (side == 'up') {
        translate.y += (+size.y * percentage) / 100;
        translate.x += 0;
        translate.z += 0;
      }
      this._object_ids[index].objects.forEach((element) => {
        let _obj: any = this._scene.getObjectByName(element.object_id);
        _obj.applyMatrix4(new THREE.Matrix4().makeTranslation(translate.x, translate.y, translate.z));
      });
    }
  }

  private _updateroomcolor(item: any, index: number): void {
    // Change the color of the room when, for the bound entity, when the state matches the condition

    let _room: any = this._scene.getObjectByName(this._rooms[index]);

    const color: string = item.room.color ? item.room.color : '#ffffff';

    if (_room && _room instanceof THREE.Mesh) {
      let i: any;
      let defaultcolor = true;

      const _object: any = _room;

      for (i in item.colorcondition) {
        if (this._states[index] == item.colorcondition[i].state) {
          const colorcond: THREE.Color = new THREE.Color(item.colorcondition[i].color);
          _object.material.color.set(colorcond);
          _object.material.emissive.set(colorcond);
          defaultcolor = false;
          break;
        }
      }
      if (defaultcolor) {
        _object.material.color.set(color);
        _object.material.emissive.set(color);
      }
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
      //object clickable: check layers solution
      const _object: any = this._scene.getObjectByName(element.object_id);

      if (_object) {
        if (this._states[index] == item.hide.state) {
          //TODO: Layers to hide ?
          _object.visible = false;
        } else {
          _object.visible = true;
        }
      }
    });
    this._renderer.shadowMap.needsUpdate = true;
  }

  private _updateshow(item: Floor3dCardConfig, index: number): void {
    // hide the object when the state is equal to the configured value
    this._object_ids[index].objects.forEach((element) => {
      const _object: any = this._scene.getObjectByName(element.object_id);

      if (_object) {
        if (this._states[index] == item.show.state) {
          _object.visible = true;
        } else {
          //TODO: Layers to hide ?
          _object.visible = false;
        }
      }
    });
    this._renderer.shadowMap.needsUpdate = true;
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
      <ha-card
        tabindex="0"
        .style=${`${
          this._config.style || 'overflow: hidden; width: auto; height: ' + htmlHeight + '; position: relative;'
        }`}
        id="${this._card_id}"
      >
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
