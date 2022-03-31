/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { ButtonBase } from '@material/mwc-button/mwc-button-base.js';
import { styles as buttonStyles } from '@material/mwc-button/styles.css.js';
import { customElement, property } from "lit/decorators.js";

@customElement("floor3d-button")
export class Floor3dButton extends ButtonBase {

    static get styles() {
        return buttonStyles;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "floor3d-button": Floor3dButton;
    }
}
