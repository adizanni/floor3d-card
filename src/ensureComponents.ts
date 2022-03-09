// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const loadHaComponents = () => {
    if (
        !customElements.get("hui-action-editor") ||
        !customElements.get("ha-icon-picker") ||
        !customElements.get("ha-entity-picker")
    ) {
        (customElements.get("hui-button-card") as any)?.getConfigElement();
    }
};