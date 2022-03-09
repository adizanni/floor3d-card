/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { FormfieldBase } from '@material/mwc-formfield/mwc-formfield-base.js';
import { styles as formfieldStyles } from '@material/mwc-formfield/mwc-formfield.css.js';
import { customElement, property } from "lit/decorators.js";

@customElement("floor3d-formfield")
export class Floor3dFormField extends FormfieldBase {

    static get styles() {
        return formfieldStyles;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "floor3d-formfield": Floor3dFormField;
    }
}
