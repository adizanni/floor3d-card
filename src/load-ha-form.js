// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const loadHaForm = async () => {
    if (customElements.get("ha-paper-dropdown-menu")) return;

    await customElements.whenDefined("partial-panel-resolver");
    const ppr = document.createElement('partial-panel-resolver');
    ppr.hass = {
        panels: [{
            url_path: "tmp",
            component_name: "config",
        }]
    };
    ppr._updateRoutes();
    await ppr.routerOptions.routes.tmp.load();

    await customElements.whenDefined("ha-panel-config");
    const cpr = document.createElement("ha-panel-config");
    await cpr.routerOptions.routes.automation.load();
}