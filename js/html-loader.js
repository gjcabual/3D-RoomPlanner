// js/html-loader.js

(function () {
  const components = [
    {
      id: "profile-circle-container",
      file: "components/html/profile-circle.html",
    },
    { id: "instructions-container", file: "components/html/instructions.html" },
    {
      id: "sources-panel-container",
      file: "components/html/sources-panel.html",
    },
    { id: "cost-panel-container", file: "components/html/cost-panel.html" },
    { id: "side-panel-container", file: "components/html/side-panel.html" },
    { id: "resize-panel-container", file: "components/html/resize-panel.html" },
    {
      id: "furniture-controls-container",
      file: "components/html/furniture-controls.html",
    },
    { id: "auth-modal-container", file: "components/html/auth-modal.html" },
    { id: "dialog-modal-container", file: "components/html/dialog-modal.html" },
  ];

  const loadComponent = async (component) => {
    try {
      const response = await fetch(component.file);
      if (!response.ok) throw new Error(`Failed to load ${component.file}`);
      const html = await response.text();
      const container = document.getElementById(component.id);
      if (container) {
        container.outerHTML = html;
      } else {
        console.error(
          `Container #${component.id} not found for ${component.file}`
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadAll = async () => {
    await Promise.all(components.map(loadComponent));
    console.log("All components loaded");
    window.dispatchEvent(new Event("componentsLoaded"));
  };

  window.htmlLoader = {
    ready: loadAll(),
  };
})();
