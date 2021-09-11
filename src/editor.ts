/* eslint-disable @typescript-eslint/ban-types */
import { LitElement, CSSResultGroup, css } from 'lit';
import { property, customElement, state, query } from 'lit/decorators';
import { TemplateResult, html } from 'lit';
import { HomeAssistant, fireEvent, LovelaceCardEditor, ActionConfig } from 'custom-card-helpers';
import {
  createEditorConfigArray,
  arrayMove,
  hasConfigOrEntitiesChanged,
  createEditorObjectGroupConfigArray,
} from './helpers';
import { Floor3dCardConfig } from './types';
import { Floor3dCard } from './floor3d-card';
//import '@vaadin/vaadin-combo-box/theme/material/vaadin-combo-box-light';

@customElement('floor3d-card-editor')
export class Floor3dCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: Floor3dCardConfig;
  @state() private _toggle?: boolean;
  @state() private _helpers?: any;
  private _configArray: any[] = [];
  private _configObjectArray: any[] = [];
  private _entityOptionsArray: object[] = [];
  private _entityOptionsGroupArray: object[] = [];
  private _options: any;
  private _initialized = false;
  private _objects: any;
  private _entity_ids: string[];
  private _visible: any[];

  public setConfig(config: Floor3dCardConfig): void {
    this._config = { ...config };

    if (!config.entities) {
      this._config.entities = [{ entity: '' }];
    }

    if (!config.object_groups) {
      this._config.object_groups = [{ object_group: '' }];
    }

    this._configArray = createEditorConfigArray(this._config);
    this._configObjectArray = createEditorObjectGroupConfigArray(this._config);

    for (const entityConfig of this._configArray) {
      if (entityConfig.light) {
        if (Object.entries(entityConfig.light).length === 0) {
          delete entityConfig.light;
        }
      }
      if (entityConfig.hide) {
        if (Object.entries(entityConfig.hide).length === 0) {
          delete entityConfig.hide;
        }
      }
    }
    this._config.object_groups = this._configObjectArray;
    this._config.entities = this._configArray;

    //console.log(JSON.stringify(this._config));

    const typeOptions = {
      icon: 'book-variant',
      name: 'Type and Object',
      secondary: 'Type and Object settings.',
      show: false,
    };

    const appearanceOptions = {
      icon: 'palette',
      name: 'Appearance',
      secondary: 'Appearance settings.',
      show: false,
    };

    const colorOptions = {
      icon: 'format-color-fill',
      name: 'Color',
      secondary: 'Color condition.',
      show: false,
      visible: false,
    };

    this.hass.resources;
    const hideOptions = {
      icon: 'eye-off',
      name: 'Hide',
      secondary: 'Hide options.',
      show: false,
      visible: false,
    };

    const showOptions = {
      icon: 'eye',
      name: 'Show',
      secondary: 'Show options.',
      show: false,
      visible: false,
    };

    const rotateOptions = {
      icon: 'fan',
      name: 'Rotate',
      secondary: 'Rotate options.',
      show: false,
      visible: false,
    };

    const lightOptions = {
      icon: 'lightbulb-on-outline',
      name: 'Light',
      secondary: 'Light options',
      show: false,
      visible: false,
    };

    const textOptions = {
      icon: 'format-text',
      name: 'Text',
      secondary: 'Text options.',
      show: false,
      visible: false,
    };

    const doorOptions = {
      icon: 'door',
      name: 'Door',
      secondary: 'Door options.',
      show: false,
      visible: false,
    };

    const gestureOptions = {
      icon: 'gesture-tap',
      name: 'Gesture',
      secondary: 'Gesture options.',
      show: false,
      visible: false,
    };

    const objectGroupOptions = {
      icon: 'cube-unfolded',
      name: 'Objects',
      secondary: 'Objects.',
      show: false,
      visible: false,
    };

    const actionsOptions = {
      icon: 'gesture-tap',
      name: 'Actions',
      secondary: 'Coming soon... Use code editor for Actions.',
      show: false,
    };

    const entityOptions = {
      show: false,
      options: {
        threed: { ...typeOptions },
        light: { ...lightOptions },
        color: { ...colorOptions },
        hide: { ...hideOptions },
        show: { ...showOptions },
        text: { ...textOptions },
        door: { ...doorOptions },
        rotate: { ...rotateOptions },
        gesture: { ...gestureOptions },
      },
    };

    for (const objectconfig of this._configObjectArray) {
      this._entityOptionsGroupArray.push({ ...objectGroupOptions });
    }

    for (const config of this._configArray) {
      this._entityOptionsArray.push({ ...entityOptions });
    }
    if (!this._options) {
      this._options = {
        object_groups: {
          icon: 'group',
          name: 'Object Groups',
          secondary: 'Manage card Object Groups.',
          show: true,
          options: {
            object_groups: this._entityOptionsGroupArray,
          },
        },
        entities: {
          icon: 'tune',
          name: 'Entities',
          secondary: 'Manage card entities.',
          show: true,
          options: {
            entities: this._entityOptionsArray,
          },
        },
        model: {
          icon: 'video-3d',
          name: '3D Model',
          secondary: 'Reference your Waterfront 3D model',
          show: false,
        },
        appearance: {
          icon: 'palette',
          name: 'Appearance',
          secondary: 'Customize the global appearance and behavior settings',
          show: false,
        },
      };
    }

    if (this._config.objectlist && !this._objects) {
      this._fetchObjectList();
    }

    fireEvent(this, 'config-changed', { config: this._config });
  }

  get _show_warning(): boolean {
    return this._config?.show_warning || false;
  }

  get _show_error(): boolean {
    return this._config?.show_error || false;
  }

  private _fetchObjectList(): void {
    fetch(this._config.path + this._config.objectlist)
      .then(function (response): any {
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(this._onobjectloaded.bind(this));
  }

  private _onobjectloaded(json: any): void {
    this._objects = Object.keys(json).sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
  }

  protected shouldUpdate(): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    return true;
  }

  protected render(): TemplateResult | void {
    return html`
      <div class="sub-category" style="display: flex; flex-direction: row; align-items: left;">
        <ha-icon @click=${this._config_changed} icon="mdi:refresh" class="ha-icon-large"> </ha-icon>
      </div>
      ${this._createModelElement()} ${this._createAppearanceElement()} ${this._createEntitiesElement()}
      ${this._createObjectGroupsElement()}
    `;
  }

  private _preview_card(): Element {
    let root: any = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-dialog-edit-card');
    root = root && root.shadowRoot;
    root = root && root.querySelector('ha-dialog');

    const preview_card: HTMLCollection = root.getElementsByTagName('floor3d-card');

    if (preview_card.length == 0) {
      return null;
    } else {
      return preview_card.item(0);
    }
  }

  private _config_changed(): void {
    let preview_card: Floor3dCard = this._preview_card() as Floor3dCard;

    if (preview_card) {
      preview_card.rerender();
    }
  }

  private _createObjectGroupsValues(): TemplateResult[] {
    if (!this.hass || !this._config) {
      return [html``];
    }

    const options = this._options.object_groups;
    //console.log('options group values: ' + JSON.stringify(options));
    const valueElementArray: TemplateResult[] = [];
    for (const config of this._configObjectArray) {
      const index = this._configObjectArray.indexOf(config);
      valueElementArray.push(html`
        <div class="sub-category" style="display: flex; flex-direction: row; align-items: center;">
          <div style="display: flex; align-items: center; flex-direction: column;">
            <div
              style="font-size: 10px; margin-bottom: -8px; opacity: 0.5;"
              @click=${this._toggleThing}
              .options=${options.options.object_groups[index]}
              .optionsTarget=${options.options.object_groups}
              .index=${index}
            >
              options
            </div>
            <ha-icon
              icon="mdi:chevron-${options.options.object_groups[index].show ? 'up' : 'down'}"
              @click=${this._toggleThing}
              .options=${options.options.object_groups[index]}
              .optionsTarget=${options.options.object_groups}
              .index=${index}
            ></ha-icon>
          </div>
          <div class="value" style="flex-grow: 1;">
            <paper-input
              label="Object Group"
              @value-changed=${this._valueChanged}
              .configAttribute=${'object_group'}
              .configObject=${this._configObjectArray[index]}
              .value=${config.object_group}
            >
            </paper-input>
          </div>
          ${index !== 0
            ? html`
                <ha-icon
                  class="ha-icon-large"
                  icon="mdi:arrow-up"
                  @click=${this._moveObject_Group}
                  .configDirection=${'up'}
                  .configArray=${this._config!.object_groups}
                  .arrayAttribute=${'object_groups'}
                  .arraySource=${this._config}
                  .index=${index}
                ></ha-icon>
              `
            : html` <ha-icon icon="mdi:arrow-up" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
          ${index !== this._configObjectArray.length - 1
            ? html`
                <ha-icon
                  class="ha-icon-large"
                  icon="mdi:arrow-down"
                  @click=${this._moveObject_Group}
                  .configDirection=${'down'}
                  .configArray=${this._config!.object_groups}
                  .arrayAttribute=${'object_groups'}
                  .arraySource=${this._config}
                  .index=${index}
                ></ha-icon>
              `
            : html` <ha-icon icon="mdi:arrow-down" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
          <ha-icon
            class="ha-icon-large"
            icon="mdi:close"
            @click=${this._removeObject_Group}
            .configAttribute=${'object_group'}
            .configArray=${'object_groups'}
            .configIndex=${index}
          ></ha-icon>
        </div>
        ${options.options.object_groups[index].show
          ? html` <div class="options">${this._createObject_GroupElement(index)}</div> `
          : ''}
      `);
    }
    return valueElementArray;
  }

  private _createActionsElement(): TemplateResult {
    const options = this._options.actions;
    return html`
      <div class="sub-category" style="opacity: 0.5;">
        <div>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
      </div>
    `;
  }

  private _createEntitiesValues(): TemplateResult[] {
    if (!this.hass || !this._config) {
      return [html``];
    }

    const options = this._options.entities;
    if (!this._entity_ids) {
      this._entity_ids = Object.keys(this.hass.states).sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
    }
    const valueElementArray: TemplateResult[] = [];
    for (const config of this._configArray) {
      const index = this._configArray.indexOf(config);
      valueElementArray.push(html`
        <div class="sub-category" style="display: flex; flex-direction: row; align-items: center;">
          <div style="display: flex; align-items: center; flex-direction: column;">
            <div
              style="font-size: 10px; margin-bottom: -8px; opacity: 0.5;"
              @click=${this._toggleThing}
              .options=${options.options.entities[index]}
              .optionsTarget=${options.options.entities}
              .index=${index}
            >
              options
            </div>
            <ha-icon
              icon="mdi:chevron-${options.options.entities[index].show ? 'up' : 'down'}"
              @click=${this._toggleThing}
              .options=${options.options.entities[index]}
              .optionsTarget=${options.options.entities}
              .index=${index}
            ></ha-icon>
          </div>
          <div class="values" style="flex-grow: 1;">
            ${this._entity_ids.length < 100
              ? html`<paper-dropdown-menu
                  label="Entity (Required)"
                  @value-changed=${this._valueChanged}
                  .configAttribute=${'entity'}
                  .configObject=${this._configArray[index]}
                  .ignoreNull=${true}
                >
                  <paper-listbox slot="dropdown-content" .selected=${this._entity_ids.indexOf(config.entity)}>
                    ${this._entity_ids.map((entity) => {
                      return html` <paper-item>${entity}</paper-item> `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>`
              : html`
                  <paper-input
                    label="Entity"
                    @value-changed=${this._valueChanged}
                    .configAttribute=${'entity'}
                    .configObject=${this._configArray[index]}
                    .value=${config.entity}
                  >
                  </paper-input>
                `}
          </div>
          ${index !== 0
            ? html`
                <ha-icon
                  class="ha-icon-large"
                  icon="mdi:arrow-up"
                  @click=${this._moveEntity}
                  .configDirection=${'up'}
                  .configArray=${this._config!.entities}
                  .arrayAttribute=${'entities'}
                  .arraySource=${this._config}
                  .index=${index}
                ></ha-icon>
              `
            : html` <ha-icon icon="mdi:arrow-up" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
          ${index !== this._configArray.length - 1
            ? html`
                <ha-icon
                  class="ha-icon-large"
                  icon="mdi:arrow-down"
                  @click=${this._moveEntity}
                  .configDirection=${'down'}
                  .configArray=${this._config!.entities}
                  .arrayAttribute=${'entities'}
                  .arraySource=${this._config}
                  .index=${index}
                ></ha-icon>
              `
            : html` <ha-icon icon="mdi:arrow-down" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
          <ha-icon
            class="ha-icon-large"
            icon="mdi:close"
            @click=${this._removeEntity}
            .configAttribute=${'entity'}
            .configArray=${'entities'}
            .configIndex=${index}
          ></ha-icon>
        </div>
        ${options.options.entities[index].show
          ? html`
              <div class="options">
                ${this._createTypeElement(index)} ${this._createLightElement(index)}
                ${this._createColorConditionElement(index)} ${this._createHideElement(index)}
                ${this._createShowElement(index)} ${this._createTextElement(index)} ${this._createGestureElement(index)}
                ${this._createDoorElement(index)} ${this._createRotateElement(index)}
              </div>
            `
          : ''}
      `);
    }
    return valueElementArray;
  }

  private _createObjectGroupsElement(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }
    const options = this._options.object_groups;

    return html`
      <div class="card-config">
        <div class="option" @click=${this._toggleThing} .options=${options} .optionsTarget=${this._options}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
            <ha-icon .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`} style="margin-left: auto;"></ha-icon>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
        ${options.show
          ? html`
              <div class="card-background" style="max-height: 400px; overflow: auto;">
                ${this._createObjectGroupsValues()}
                <div class="sub-category" style="display: flex; flex-direction: column; align-items: flex-end;">
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:plus"
                    .configArray=${this._configObjectArray}
                    .configAddValue=${'object_group'}
                    .sourceArray=${this._config.object_groups}
                    @click=${this._addObject_Group}
                  ></ha-icon>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _createEntitiesElement(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }
    const options = this._options.entities;

    return html`
      <div class="card-config">
        <div class="option" @click=${this._toggleThing} .options=${options} .optionsTarget=${this._options}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
            <ha-icon .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`} style="margin-left: auto;"></ha-icon>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
        ${options.show
          ? html`
              <div class="card-background" style="max-height: 400px; overflow: auto;">
                ${this._createEntitiesValues()}
                <div class="sub-category" style="display: flex; flex-direction: column; align-items: flex-end;">
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:plus"
                    .configArray=${this._configArray}
                    .configAddValue=${'entity'}
                    .sourceArray=${this._config.entities}
                    @click=${this._addEntity}
                  ></ha-icon>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _createModelElement(): TemplateResult {
    if (!this.hass) {
      return html``;
    }
    const config: any = this._config;
    const index = null;
    const options = this._options.model;
    return html`
      <div class="category" id="card">
        <div class="sub-category" @click=${this._toggleThing} .options=${options} .optionsTarget=${this._options}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
            <ha-icon .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`} style="margin-left: auto;"></ha-icon>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
        ${options.show
          ? html`
              <div class="value-container">
                <ha-file-upload> </ha-file-upload>
                <paper-input
                  editable
                  label="Name"
                  .value="${config.name ? config.name : ''}"
                  .configObject=${config}
                  .configAttribute=${'name'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Path"
                  .value="${config.path ? config.path : ''}"
                  .configObject=${config}
                  .configAttribute=${'path'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Obj Wavefront file"
                  .value="${config.objfile ? config.objfile : ''}"
                  .configObject=${config}
                  .configAttribute=${'objfile'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Mtl Wavefront file"
                  .value="${config.mtlfile ? config.mtlfile : ''}"
                  .configObject=${config}
                  .configAttribute=${'mtlfile'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Object list JSON"
                  .value="${config.objectlist ? config.objectlist : ''}"
                  .configObject=${config}
                  .configAttribute=${'objectlist'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _createAppearanceElement(): TemplateResult {
    if (!this.hass) {
      return html``;
    }
    const config: any = this._config;
    const index = null;
    const options = this._options.appearance;
    return html`
      <div class="category" id="card">
        <div class="sub-category" @click=${this._toggleThing} .options=${options} .optionsTarget=${this._options}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
            <ha-icon .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`} style="margin-left: auto;"></ha-icon>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
        ${options.show
          ? html`
              <div class="value-container">
                <paper-input
                  editable
                  label="Style"
                  .value="${config.style ? config.style : ''}"
                  .configObject=${config}
                  .configAttribute=${'style'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Background Color"
                  .value="${config.backgroundColor ? config.backgroundColor : ''}"
                  .configObject=${config}
                  .configAttribute=${'backgroundColor'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Global Scene Light"
                  .value=${config.globalLightPower ? config.globalLightPower : ''}
                  .configObject=${config}
                  .configAttribute=${'globalLightPower'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Shadow"
                  .value=${config.shadow ? config.shadow : ''}
                  .configObject=${config}
                  .configAttribute=${'shadow'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Camera Position"
                  .value=${config.camera_position ? config.camera_position : ''}
                  .configObject=${config}
                  .configAttribute=${'camera_position'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-input
                  editable
                  label="Camera Rotation"
                  .value=${config.camera_rotate ? config.camera_rotate : ''}
                  .configObject=${config}
                  .configAttribute=${'camera_rotate'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _toggleThing(ev): void {
    const options = ev.target.options;
    const show = !options.show;
    if (ev.target.optionsTarget) {
      if (Array.isArray(ev.target.optionsTarget)) {
        for (const options of ev.target.optionsTarget) {
          options.show = false;
        }
      } else {
        for (const [key] of Object.entries(ev.target.optionsTarget)) {
          ev.target.optionsTarget[key].show = false;
        }
      }
    }
    options.show = show;
    this._toggle = !this._toggle;
  }

  private _addObject_Group(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    let newObject;
    if (target.configAddObject) {
      newObject = target.configAddObject;
    } else {
      newObject = { [target.configAddValue]: '' };
    }
    const newArray = target.configArray.slice();
    newArray.push(newObject);
    this._config.object_groups = newArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _addEntity(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    let newObject;
    if (target.configAddObject) {
      newObject = target.configAddObject;
    } else {
      newObject = { [target.configAddValue]: '' };
    }
    const newArray = target.configArray.slice();
    newArray.push(newObject);
    this._config.entities = newArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _moveEntity(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    let newArray = target.configArray.slice();
    if (target.configDirection == 'up') newArray = arrayMove(newArray, target.index, target.index - 1);
    else if (target.configDirection == 'down') newArray = arrayMove(newArray, target.index, target.index + 1);
    this._config.entities = newArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _moveObject_Group(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    let newArray = target.configArray.slice();
    if (target.configDirection == 'up') newArray = arrayMove(newArray, target.index, target.index - 1);
    else if (target.configDirection == 'down') newArray = arrayMove(newArray, target.index, target.index + 1);
    this._config.object_groups = newArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _removeEntity(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    const entitiesArray: Floor3dCardConfig[] = [];
    let index = 0;
    for (const config of this._configArray) {
      if (target.configIndex !== index) {
        entitiesArray.push(config);
      }
      index++;
    }
    const newConfig = { [target.configArray]: entitiesArray };
    this._config = Object.assign(this._config, newConfig);
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _removeObject_Group(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    const object_groupsArray: Floor3dCardConfig[] = [];
    let index = 0;
    for (const config of this._configObjectArray) {
      if (target.configIndex !== index) {
        object_groupsArray.push(config);
      }
      index++;
    }
    const newConfig = { [target.configArray]: object_groupsArray };
    this._config = Object.assign(this._config, newConfig);
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _createTypeElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.threed;
    const config = this._configArray[index];
    return html`
      <div class="category" id="type">
        <div
          class="sub-category"
          @click=${this._toggleThing}
          .options=${options}
          .optionsTarget=${this._options.entities.options.entities[index].options}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
            <div class="title">${options.name}</div>
            <ha-icon .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`} style="margin-left: auto;"></ha-icon>
          </div>
          <div class="secondary">${options.secondary}</div>
        </div>
        ${options.show
          ? html`
              <div class="value">
                <div>
                  <paper-input
                    label="Entity template"
                    .value="${config.entity_template ? config.entity_template : ''}"
                    editable
                    .configAttribute=${'entity_template'}
                    .configObject=${config}
                    @value-changed=${this._valueChanged}
                  ></paper-input>
                  <paper-dropdown-menu
                    label="3D Type"
                    @selected-item-changed=${this._typeChanged}
                    .optionTgt=${this._options.entities.options.entities[index].options}
                    .configObject=${config}
                    .configAttribute=${'type3d'}
                    .ignoreNull=${true}
                  >
                    <paper-listbox
                      slot="dropdown-content"
                      attr-for-selected="item-name"
                      selected="${config.type3d ? config.type3d : null}"
                    >
                      <paper-item item-name="light">light</paper-item>
                      <paper-item item-name="color">color</paper-item>
                      <paper-item item-name="hide">hide</paper-item>
                      <paper-item item-name="show">show</paper-item>
                      <paper-item item-name="text">text</paper-item>
                      <paper-item item-name="door">door</paper-item>
                      <paper-item item-name="rotate">rotate</paper-item>
                      <paper-item item-name="gesture">gesture</paper-item>
                    </paper-listbox>
                  </paper-dropdown-menu>
                  ${!this._objects
                    ? html`
                        <paper-input
                          label="Object"
                          .value="${config.object_id ? config.object_id : ''}"
                          editable
                          .configAttribute=${'object_id'}
                          .configObject=${config}
                          @value-changed=${this._valueChanged}
                        ></paper-input>
                      `
                    : html`
                        <paper-dropdown-menu
                          label="Object id"
                          @selected-item-changed=${this._valueChanged}
                          .configAttribute=${'object_id'}
                          .configObject=${config}
                          .ignoreNull=${true}
                        >
                          <paper-listbox slot="dropdown-content" .selected=${this._objects.indexOf(config.object_id)}>
                            ${this._objects.map((object_id) => {
                              return html` <paper-item>${object_id}</paper-item> `;
                            })}
                          </paper-listbox>
                        </paper-dropdown-menu>
                      `}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _createObject_GroupElement(index): TemplateResult {
    const options = this._options.object_groups.options.object_groups[index];
    const config = this._configObjectArray[index];
    const arrayLength = config.objects ? config.objects.length : 0;
    const visible = true;
    return html`
      ${visible
        ? html`
            <div class="category" id="bar">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.object_groups.options.object_groups}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="card-background" style="overflow: auto; max-height: 420px;">
                      ${arrayLength > 0 ? html` ${this._createObjectValues(index)} ` : ''}
                      <div class="sub-category" style="display: flex; flex-direction: column; align-items: flex-end;">
                        <ha-icon
                          class="ha-icon-large"
                          icon="mdi:plus"
                          .index=${index}
                          @click=${this._addObject}
                        ></ha-icon>
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createColorConditionElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.color;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'color' : false;
    const arrayLength = config.colorcondition ? config.colorcondition.length : 0;
    return html`
      ${visible
        ? html`
            <div class="category" id="bar">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="card-background" style="overflow: auto; max-height: 420px;">
                      ${arrayLength > 0 ? html` ${this._createColorConditionValues(index)} ` : ''}
                      <div class="sub-category" style="display: flex; flex-direction: column; align-items: flex-end;">
                        <ha-icon
                          class="ha-icon-large"
                          icon="mdi:plus"
                          .index=${index}
                          @click=${this._addColorCondition}
                        ></ha-icon>
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createObjectValues(index): TemplateResult[] {
    const config = this._configObjectArray[index];

    const objectValuesArray: TemplateResult[] = [];
    for (const object_id of config.objects) {
      const objectIndex = config.objects.indexOf(object_id);
      objectValuesArray.push(html`
        <div class="sub-category" style="display: flex; flex-direction: row; align-items: center;">
          <div class="value">
            <div style="display:flex;">
              <paper-input
                label="Object Id"
                .value="${object_id.object_id ? object_id.object_id : ''}"
                editable
                .objectAttribute=${'object_id'}
                .index=${index}
                .objectIndex=${objectIndex}
                @value-changed=${this._updateObject}
              ></paper-input>
            </div>
          </div>
          <div style="display: flex;">
            ${objectIndex !== 0
              ? html`
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:arrow-up"
                    @click=${this._moveObject}
                    .configDirection=${'up'}
                    .index=${index}
                    .objectIndex=${objectIndex}
                  ></ha-icon>
                `
              : html` <ha-icon icon="mdi:arrow-up" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
            ${objectIndex !== config.objects.length - 1
              ? html`
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:arrow-down"
                    @click=${this._moveObject}
                    .configDirection=${'down'}
                    .index=${index}
                    .objectIndex=${objectIndex}
                  ></ha-icon>
                `
              : html` <ha-icon icon="mdi:arrow-down" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
            <ha-icon
              class="ha-icon-large"
              icon="mdi:close"
              @click=${this._removeObject}
              .index=${index}
              .objectIndex=${objectIndex}
            ></ha-icon>
          </div>
        </div>
      `);
    }
    return objectValuesArray;
  }

  private _createColorConditionValues(index): TemplateResult[] {
    const config = this._configArray[index];

    const colorconditionValuesArray: TemplateResult[] = [];
    for (const colorcondition of config.colorcondition) {
      const colorconditionIndex = config.colorcondition.indexOf(colorcondition);
      colorconditionValuesArray.push(html`
        <div class="sub-category" style="display: flex; flex-direction: row; align-items: center;">
          <div class="value">
            <div style="display:flex;">
              <paper-input
                label="Color"
                .value="${colorcondition.color ? colorcondition.color : ''}"
                editable
                .colorconditionAttribute=${'color'}
                .index=${index}
                .colorconditionIndex=${colorconditionIndex}
                @value-changed=${this._updateColorCondition}
              ></paper-input>
              <paper-input
                label="State"
                .value="${colorcondition.state ? colorcondition.state : ''}"
                editable
                .colorconditionAttribute=${'state'}
                .index=${index}
                .colorconditionIndex=${colorconditionIndex}
                @value-changed=${this._updateColorCondition}
              ></paper-input>
            </div>
          </div>
          <div style="display: flex;">
            ${colorconditionIndex !== 0
              ? html`
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:arrow-up"
                    @click=${this._moveColorCondition}
                    .configDirection=${'up'}
                    .index=${index}
                    .colorconditionIndex=${colorconditionIndex}
                  ></ha-icon>
                `
              : html` <ha-icon icon="mdi:arrow-up" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
            ${colorconditionIndex !== config.colorcondition.length - 1
              ? html`
                  <ha-icon
                    class="ha-icon-large"
                    icon="mdi:arrow-down"
                    @click=${this._moveColorCondition}
                    .configDirection=${'down'}
                    .index=${index}
                    .colorconditionIndex=${colorconditionIndex}
                  ></ha-icon>
                `
              : html` <ha-icon icon="mdi:arrow-down" style="opacity: 25%;" class="ha-icon-large"></ha-icon> `}
            <ha-icon
              class="ha-icon-large"
              icon="mdi:close"
              @click=${this._removeColorCondition}
              .index=${index}
              .colorconditionIndex=${colorconditionIndex}
            ></ha-icon>
          </div>
        </div>
      `);
    }
    return colorconditionValuesArray;
  }

  private _addObject(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    let objectArray = this._config.object_groups[target.index].objects;

    if (!objectArray) {
      objectArray = [];
    }

    const newObject = { object_id: '' };
    const newArray = objectArray.slice();
    newArray.push(newObject);

    this._configObjectArray[target.index].objects = newArray;

    this._config.object_groups = this._configObjectArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _addColorCondition(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    let colorconditionArray = this._config.entities[target.index].colorcondition;

    if (!colorconditionArray) {
      colorconditionArray = [];
    }

    const newObject = { state: '', color: '' };
    const newArray = colorconditionArray.slice();
    newArray.push(newObject);

    this._configArray[target.index].colorcondition = newArray;

    this._config.entities = this._configArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _moveObject(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    const objectArray = this._config.object_groups[target.index].objects;

    let newArray = objectArray.slice();
    if (target.configDirection == 'up') {
      newArray = arrayMove(newArray, target.objectIndex, target.objectIndex - 1);
    } else if (target.configDirection == 'down') {
      newArray = arrayMove(newArray, target.objectIndex, target.objectIndex + 1);
    }

    this._configObjectArray[target.index].objects = newArray;

    this._config.object_groups = this._configObjectArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _moveColorCondition(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    const colorconditionArray = this._config.entities[target.index].colorcondition;

    let newArray = colorconditionArray.slice();
    if (target.configDirection == 'up') {
      newArray = arrayMove(newArray, target.colorconditionIndex, target.colorconditionIndex - 1);
    } else if (target.configDirection == 'down') {
      newArray = arrayMove(newArray, target.colorconditionIndex, target.colorconditionIndex + 1);
    }

    this._configArray[target.index].colorconditions = newArray;

    this._config.entities = this._configArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _removeObject(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    const objectArray = this._configObjectArray[target.index].objects;

    const clonedArray = objectArray.slice();
    const newArray: any = [];
    let arrayIndex = 0;
    for (const config of clonedArray) {
      if (target.objectIndex !== arrayIndex) {
        newArray.push(clonedArray[arrayIndex]);
      }
      arrayIndex++;
    }
    if (newArray.length === 0) {
      delete this._configObjectArray[target.index].objects;
    } else {
      this._configObjectArray[target.index].objects = newArray;
    }
    this._config.object_groups = this._configObjectArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _removeColorCondition(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;

    const colorconditionArray = this._configArray[target.index].colorcondition;

    const clonedArray = colorconditionArray.slice();
    const newArray: any = [];
    let arrayIndex = 0;
    for (const config of clonedArray) {
      if (target.colorconditionIndex !== arrayIndex) {
        newArray.push(clonedArray[arrayIndex]);
      }
      arrayIndex++;
    }
    if (newArray.length === 0) {
      delete this._configArray[target.index].colorcondition;
    } else {
      this._configArray[target.index].colorcondition = newArray;
    }
    this._config.entities = this._configArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _updateObject(ev): void {
    const target = ev.target;

    const objectArray = this._configObjectArray[target.index].objects;

    const newobjectArray: any = [];
    for (const index in objectArray) {
      if (target.objectIndex == index) {
        const clonedObject = { ...objectArray[index] };
        const newObject = { [target.objectAttribute]: target.value };
        const mergedObject = Object.assign(clonedObject, newObject);
        if (target.value == '') {
          delete mergedObject[target.objectAttribute];
        }
        newobjectArray.push(mergedObject);
      } else {
        newobjectArray.push(objectArray[index]);
      }
    }

    this._configObjectArray[target.index].objects = newobjectArray;

    this._config.object_groups = this._configObjectArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _updateColorCondition(ev): void {
    const target = ev.target;

    const colorconditionArray = this._configArray[target.index].colorcondition;

    const newcolorconditionArray: any = [];
    for (const index in colorconditionArray) {
      if (target.colorconditionIndex == index) {
        const clonedObject = { ...colorconditionArray[index] };
        const newObject = { [target.colorconditionAttribute]: target.value };
        const mergedObject = Object.assign(clonedObject, newObject);
        if (target.value == '') {
          delete mergedObject[target.colorconditionAttribute];
        }
        newcolorconditionArray.push(mergedObject);
      } else {
        newcolorconditionArray.push(colorconditionArray[index]);
      }
    }

    this._configArray[target.index].colorcondition = newcolorconditionArray;

    this._config.entities = this._configArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _createLightElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.light;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'light' : false;
    if (visible) {
      config.light = { ...config.light };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="light">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-input
                                class="value-number"
                                type="number"
                                label="Lumens"
                                .value=${config.light.lumens ? config.light.lumens : ''}
                                .configObject=${config.light}
                                .configAttribute=${'lumens'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-dropdown-menu
                                label="Light Vertical Alignment"
                                @selected-item-changed=${this._valueChanged}
                                .configObject=${config.light}
                                .configAttribute=${'vertical_alignment'}
                                .ignoreNull=${true}
                              >
                                <paper-listbox
                                  slot="dropdown-content"
                                  attr-for-selected="item-name"
                                  selected="${config.light.vertical_alignment ? config.light.vertical_alignment : null}"
                                >
                                  <paper-item item-name="bottom">bottom</paper-item>
                                  <paper-item item-name="middle">middle</paper-item>
                                  <paper-item item-name="hide">top</paper-item>
                                </paper-listbox>
                              </paper-dropdown-menu>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createTextElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.text;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'text' : false;
    if (visible) {
      config.text = { ...config.text };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="text">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-input
                                editable
                                label="font"
                                .value=${config.text.font ? config.text.font : ''}
                                .configObject=${config.text}
                                .configAttribute=${'font'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Span percentage"
                                .value=${config.text.span ? config.text.span : ''}
                                .configObject=${config.text}
                                .configAttribute=${'span'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Text Background Color"
                                .value="${config.text.textbgcolor ? config.text.textbgcolor : ''}"
                                .configObject=${config.text}
                                .configAttribute=${'textbgcolor'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Text Foreground Color"
                                .value="${config.text.textfgcolor ? config.text.textfgcolor : ''}"
                                .configObject=${config.text}
                                .configAttribute=${'textfgcolor'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createDoorElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.door;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'door' : false;
    if (visible) {
      config.door = { ...config.door };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="door">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-dropdown-menu
                                label="Door Type"
                                @selected-item-changed=${this._valueChanged}
                                .configObject=${config.door}
                                .configAttribute=${'doortype'}
                                .ignoreNull=${true}
                              >
                                <paper-listbox
                                  slot="dropdown-content"
                                  attr-for-selected="item-name"
                                  selected="${config.door.doortype ? config.door.doortype : null}"
                                >
                                  <paper-item item-name="swing">swing</paper-item>
                                  <paper-item item-name="slide">slide</paper-item>
                                </paper-listbox>
                              </paper-dropdown-menu>
                              <paper-dropdown-menu
                                label="Side"
                                @selected-item-changed=${this._valueChanged}
                                .configObject=${config.door}
                                .configAttribute=${'side'}
                                .ignoreNull=${true}
                              >
                                <paper-listbox
                                  slot="dropdown-content"
                                  attr-for-selected="item-name"
                                  selected="${config.door.side ? config.door.side : null}"
                                >
                                  <paper-item item-name="up">up</paper-item>
                                  <paper-item item-name="down">down</paper-item>
                                  <paper-item item-name="left">left</paper-item>
                                  <paper-item item-name="right">right</paper-item>
                                </paper-listbox>
                              </paper-dropdown-menu>
                              <paper-dropdown-menu
                                label="Direction"
                                @selected-item-changed=${this._valueChanged}
                                .configObject=${config.door}
                                .configAttribute=${'direction'}
                                .ignoreNull=${true}
                              >
                                <paper-listbox
                                  slot="dropdown-content"
                                  attr-for-selected="item-name"
                                  selected="${config.door.direction ? config.door.direction : null}"
                                >
                                  <paper-item item-name="inner">inner</paper-item>
                                  <paper-item item-name="outer">outer</paper-item>
                                </paper-listbox>
                              </paper-dropdown-menu>
                              <paper-input
                                editable
                                label="Degrees (for Swing)"
                                .value=${config.door.degrees ? config.door.degrees : ''}
                                .configObject=${config.door}
                                .configAttribute=${'degrees'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Percentage open (for slide)"
                                .value=${config.door.percentage ? config.door.percentage : ''}
                                .configObject=${config.door}
                                .configAttribute=${'percentage'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Pane object"
                                .value=${config.door.pane ? config.door.pane : ''}
                                .configObject=${config.door}
                                .configAttribute=${'pane'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Hinge object"
                                .value=${config.door.hinge ? config.door.hinge : ''}
                                .configObject=${config.door}
                                .configAttribute=${'hinge'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createGestureElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.gesture;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'gesture' : false;
    if (visible) {
      config.gesture = { ...config.gesture };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="text">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-input
                                editable
                                label="domain"
                                .value=${config.gesture.domain ? config.gesture.domain : ''}
                                .configObject=${config.gesture}
                                .configAttribute=${'domain'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="service"
                                .value=${config.gesture.service ? config.gesture.service : ''}
                                .configObject=${config.gesture}
                                .configAttribute=${'service'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createRotateElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.rotate;
    const config = this._configArray[index];
    const visible: boolean = config.type3d ? config.type3d === 'rotate' : false;
    if (visible) {
      config.rotate = { ...config.rotate };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="text">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
          ? html`
                           <paper-dropdown-menu
                                label="Axis"
                                @selected-item-changed=${this._valueChanged}
                                .configObject=${config.rotate}
                                .configAttribute=${'axis'}
                                .ignoreNull=${true}
                              >
                                <paper-listbox
                                  slot="dropdown-content"
                                  attr-for-selected="item-name"
                                  selected="${config.rotate.axis ? config.rotate.axis : null}"
                                >
                                  <paper-item item-name="x">x</paper-item>
                                  <paper-item item-name="y">y</paper-item>
                                  <paper-item item-name="z">z</paper-item>
                                </paper-listbox>
                              </paper-dropdown-menu>
                              <paper-input
                                editable
                                label="Hinge-pivot object "
                                .value=${config.rotate.hinge ? config.rotate.hinge : ''}
                                .configObject=${config.rotate}
                                .configAttribute=${'hinge'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                              <paper-input
                                editable
                                label="Round per seconds (2 or less recommended)"
                                .value=${config.rotate.round_per_second ? config.rotate.round_per_second : ''}
                                .configObject=${config.rotate}
                                .configAttribute=${'round_per_second'}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createHideElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.hide;
    const config = this._configArray[index];

    const visible: boolean = config.type3d ? config.type3d === 'hide' : false;

    if (visible) {
      config.hide = { ...config.hide };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="hide">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-input
                                label="state"
                                .value="${config.hide.state ? config.hide.state : ''}"
                                editable
                                .configAttribute=${'state'}
                                .configObject=${config.hide}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _createShowElement(index): TemplateResult {
    const options = this._options.entities.options.entities[index].options.show;
    const config = this._configArray[index];

    const visible: boolean = config.type3d ? config.type3d === 'show' : false;

    if (visible) {
      config.show = { ...config.show };
    }
    return html`
      ${visible
        ? html`
            <div class="category" id="show">
              <div
                class="sub-category"
                @click=${this._toggleThing}
                .options=${options}
                .optionsTarget=${this._options.entities.options.entities[index].options}
              >
                <div class="row">
                  <ha-icon .icon=${`mdi:${options.icon}`}></ha-icon>
                  <div class="title">${options.name}</div>
                  <ha-icon
                    .icon=${options.show ? `mdi:chevron-up` : `mdi:chevron-down`}
                    style="margin-left: auto;"
                  ></ha-icon>
                </div>
                <div class="secondary">${options.secondary}</div>
              </div>
              ${options.show
                ? html`
                    <div class="value">
                      <div>
                        ${index !== null
                          ? html`
                              <paper-input
                                label="state"
                                .value="${config.show.state ? config.show.state : ''}"
                                editable
                                .configAttribute=${'state'}
                                .configObject=${config.show}
                                @value-changed=${this._valueChanged}
                              ></paper-input>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}
    `;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private _toggleAction(ev): void {
    this._toggleThing(ev);
  }

  private _toggleOption(ev): void {
    this._toggleThing(ev);
  }

  private _typeChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (target.configObject[target.configAttribute] == target.value) {
      return;
    }

    this._valueChanged(ev);

    console.log('Type3D changed start');

    if (target.configObject.colorcondition) {
      delete target.configObject.colorcondition;
    }
    if (ev.target.optionTgt.color) {
      ev.target.optionTgt.color.visible = false;
    }

    if (target.configObject.hide) {
      delete target.configObject.hide;
    }
    if (ev.target.optionTgt.hide) {
      ev.target.optionTgt.hide.visible = false;
    }

    if (target.configObject.light) {
      delete target.configObject.light;
    }
    if (ev.target.optionTgt.light) {
      ev.target.optionTgt.light.visible = false;
    }

    if (target.value == 'color') {
      if (ev.target.optionTgt) {
        ev.target.optionTgt.color.visible = true;
      }
    }

    if (target.value == 'light') {
      if (ev.target.optionTgt) {
        ev.target.optionTgt.light.visible = true;
      }
    }

    if (target.value == 'hide') {
      if (ev.target.optionTgt) {
        ev.target.optionTgt.hide.visible = true;
      }
    }
    console.log('Type3D changed end');
  }

  private _valueChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (target.configObject[target.configAttribute] == target.value) {
      return;
    }

    if (target.configAdd && target.value !== '') {
      target.configObject = Object.assign(target.configObject, {
        [target.configAdd]: { [target.configAttribute]: target.value },
      });
    }
    if (target.configAttribute && target.configObject && !target.configAdd) {
      if (target.value == '' || target.value === false) {
        if (target.ignoreNull == true) return;
        delete target.configObject[target.configAttribute];
      } else {
        target.configObject[target.configAttribute] = target.value;
      }
    }
    this._config.entities = this._configArray;
    this._config.object_groups = this._configObjectArray;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static get styles(): CSSResultGroup {
    return css`
      .option {
        padding: 4px 0px;
        cursor: pointer;
      }
      .row {
        display: flex;
        margin-bottom: -14px;
        pointer-events: none;
      }
      .title {
        padding-left: 16px;
        margin-top: -6px;
        pointer-events: none;
      }
      .secondary {
        padding-left: 40px;
        color: var(--secondary-text-color);
        pointer-events: none;
      }
      .values {
        padding-left: 16px;
        background: var(--secondary-background-color);
        display: grid;
      }
      ha-formfield {
        padding-bottom: 8px;
      }
    `;
  }
}
