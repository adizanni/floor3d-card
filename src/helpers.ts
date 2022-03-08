/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PropertyValues } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { Floor3dCardConfig } from './types';

/**
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation and filtering.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
export function mergeDeep(...objects: any): any {
  const isObject = (obj: any): boolean => obj && typeof obj === 'object';

  return objects.reduce((prev: any, obj: any) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        /* eslint no-param-reassign: 0 */
        prev[key] = pVal.concat(...oVal);
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}

export function mapRange(num: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
  return ((num - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}

// Check if config or Entity changed
export function hasConfigOrEntitiesChanged(element: any, changedProps: PropertyValues, forceUpdate: boolean): boolean {
  if (changedProps.has('config') || forceUpdate) {
    return true;
  }
  for (const config of element._configArray) {
    if (config.entity) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
      if (oldHass) {
        if (oldHass.states[config.entity] !== element.hass!.states[config.entity]) {
          return true;
        } else {
          continue;
        }
      }
      return true;
    }
  }
  return false;
}

export function createConfigArray(config): Floor3dCardConfig[] {
  const configArray: Floor3dCardConfig[] = [];
  if (config.entities) {
    for (const entityConfig of config.entities) {
      if (typeof entityConfig == 'string') {
        const clonedObject = mergeDeep({}, config);
        delete clonedObject.entities;
        const stringConfig = mergeDeep(clonedObject, { entity: entityConfig });
        configArray.push(stringConfig);
      } else if (typeof entityConfig == 'object') {
        const clonedObject = mergeDeep({}, config);
        delete clonedObject.entities;
        const objectConfig = mergeDeep(clonedObject, entityConfig);
        configArray.push(objectConfig);
      }
    }
  } else {
    configArray.push(config);
  }
  return configArray;
}

export function createObjectGroupConfigArray(config): Floor3dCardConfig[] {
  const configArray: Floor3dCardConfig[] = [];
  if (config.entities) {
    for (const entityConfig of config.entities) {
      if (entityConfig.object_id) {
        if (
          entityConfig.object_id.charAt(0) == '<' &&
          entityConfig.object_id.charAt(entityConfig.object_id.length - 1) == '>'
        ) {
          const group_name = entityConfig.object_id.substr(1, entityConfig.object_id.length - 2);
          for (const objectGroupConfig of config.object_groups) {
            if (objectGroupConfig.object_group == group_name) {
              const objectConfig = mergeDeep({}, { entity: entityConfig.entity, objects: objectGroupConfig.objects });
              configArray.push(objectConfig);
              break;
            }
          }
        } else if (entityConfig.object_id !== '') {
          const objectConfig = mergeDeep(
            {},
            { entity: entityConfig.entity, objects: [{ object_id: entityConfig.object_id }] },
          );
          configArray.push(objectConfig);
        }
      }
    }
  }
  //console.log(JSON.stringify(configArray));
  return configArray;
}

export function createEditorObjectGroupConfigArray(config): Floor3dCardConfig[] {
  const configArray: Floor3dCardConfig[] = [];
  if (config.object_groups) {
    for (const objectGroupConfig of config.object_groups) {
      if (typeof objectGroupConfig == 'string') {
        const stringConfig = mergeDeep({}, { object_group: objectGroupConfig });
        configArray.push(stringConfig);
      } else if (typeof objectGroupConfig == 'object') {
        const objectConfig = mergeDeep({}, objectGroupConfig);
        configArray.push(objectConfig);
      }
    }
  } else {
    configArray.push(config);
  }
  return configArray;
}

export function createEditorConfigArray(config): Floor3dCardConfig[] {
  const configArray: Floor3dCardConfig[] = [];
  if (config.entities) {
    for (const entityConfig of config.entities) {
      if (typeof entityConfig == 'string') {
        const stringConfig = mergeDeep({}, { entity: entityConfig });
        configArray.push(stringConfig);
      } else if (typeof entityConfig == 'object') {
        const objectConfig = mergeDeep({}, entityConfig);
        configArray.push(objectConfig);
      }
    }
  } else {
    configArray.push(config);
  }
  return configArray;
}

export function arrayMove(arr, fromIndex, toIndex): any[] {
  const element = arr[fromIndex];
  const newArray = arr.slice();
  newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);
  return newArray;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const loadHaYamlEditor = async () => {
  if (customElements.get("ha-yaml-editor")) return;

  // Load in ha-yaml-editor from developer-tools-service
  const ppResolver = document.createElement("partial-panel-resolver");
  const routes = (ppResolver as any).getRoutes([
    {
      component_name: "developer-tools",
      url_path: "a",
    },
  ]);
  await routes?.routes?.a?.load?.();
  const devToolsRouter = document.createElement("developer-tools-router");
  await (devToolsRouter as any)?.routerOptions?.routes?.service?.load?.();
};
