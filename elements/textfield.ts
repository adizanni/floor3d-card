/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { TextFieldBase } from '@material/mwc-textfield/mwc-textfield-base.js';
import { styles as textfieldStyles } from '@material/mwc-textfield/mwc-textfield.css';
import { customElement, property } from "lit/decorators.js";

@customElement("floor3d-textfield")
export class Floor3dTextField extends TextFieldBase {

    static get styles() {
        return textfieldStyles;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "floor3d-textfield": Floor3dTextField;
    }
}
