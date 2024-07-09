import html from "./html-tag.mjs";

//--------------------------------------------------------------------------------------------------------------
// Register the custom element
//--------------------------------------------------------------------------------------------------------------
if (!customElements.get("geo-trouve-list")) {
  customElements.define(
    "geo-trouve-list",
    class extends HTMLElement {
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // STYLE
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      STYLE = html` <style></style>`;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // INPUTS
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // These are reflected properties, to handle changes after component initialization
      // see https://blog.ltgt.net/web-component-properties/
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      get listId() {
        return (
          this.getAttribute("listId") ??
          new URLSearchParams(window.location.search).get("listId")
        );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // SETUP
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      connectedCallback() {
        fetch(`./${this.listId}.json`)
          .then((data) => data.json())
          .then((cacheList) => {
            this.render(cacheList);
          })
          .catch((e) => {
            // TODO Gérer l'erreur
            console.error(e);
          });
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // RENDER
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      render(cacheList) {
        const cityId = cacheList.cityId;
        const cacheListName = cacheList.name;
        const caches = cacheList.caches;

        this.innerHTML = html`
          ${this.STYLE}
          <h2>${cacheListName}</h2>
          <a href="geo-trouve-city?cityId=${cityId}"
            >Revenir à la page précédente</a
          >

          <h3>Choisissez une cache</h3>

          <ul>
            ${caches
              .map(
                (cache) => html`
                  <li>
                    <a
                      href="geo-trouve?title=${cache.name}&latitude=${cache.latitude}&longitude=${cache.longitude}&listId=${this
                        .listId}"
                    >
                      ${cache.name}
                    </a>
                  </li>
                `
              )
              .join("\n")}
          </ul>
        `;
      }
    }
  );
}
