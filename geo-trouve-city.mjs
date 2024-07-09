import html from "./html-tag.mjs";

//--------------------------------------------------------------------------------------------------------------
// Register the custom element
//--------------------------------------------------------------------------------------------------------------
if (!customElements.get("geo-trouve-city")) {
  customElements.define(
    "geo-trouve-city",
    class extends HTMLElement {
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // STYLE
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      STYLE = html` <style>
        .geo-trouve-city-root {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      </style>`;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // INPUTS
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // These are reflected properties, to handle changes after component initialization
      // see https://blog.ltgt.net/web-component-properties/
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      get cityId() {
        return (
          this.getAttribute("cityId") ??
          new URLSearchParams(window.location.search).get("cityId")
        );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // SETUP
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      connectedCallback() {
        fetch(`./${this.cityId}.json`)
          .then((data) => data.json())
          .then((city) => {
            this.render(city);
          })
          .catch((e) => {
            // TODO Gérer l'erreur
            console.error(e);
          });
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // RENDER
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      render(city) {
        const cityName = city.name;
        const lists = city.lists;

        this.innerHTML = html`
          <section class="geo-trouve-city-root">
            ${this.STYLE}

            <a href="start.html">Retour à la liste des villes</a>
            <h2>${cityName}</h2>

            <p>Choisissez un thème parmi ceux disponibles</p>

            ${lists
              .map(
                (list) => html`
                  <h3>${list.name}</h3>
                  <p>${list.description}</p>
                  <a href="${list.infoUrl}" target="_blank"
                    >En savoir plus (attention, peut reveler l'emplacement des
                    caches)</a
                  >

                  <a
                    href="geo-trouve-list?listId=${list.id}"
                    class="geo-trouve-button geo-trouve-button-red"
                    ><span>Démarrer</span></a
                  >
                `
              )
              .join("\n")}
          </section>
        `;
      }
    }
  );
}
