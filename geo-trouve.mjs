import html from "./html-tag.mjs";

//--------------------------------------------------------------------------------------------------------------
// Register the custom element
//--------------------------------------------------------------------------------------------------------------
if (!customElements.get("geo-trouve")) {
  customElements.define(
    "geo-trouve",
    class extends HTMLElement {
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // STATIC PARAMETERS
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      IS_ON_TARGET_RANGE = 20;
      DISPLAY_UPDATE_INTERVAL = 3000;
      GEOLOCATION_OPTIONS = {
        // see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition#options
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 27000,
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // STYLE
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      STYLE = html` <style>
        .geo-trouve-root {
          /* from https://systemfontstack.com/ */
          font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir,
            segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto,
            arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          gap: 40px;
        }

        .geo-trouve-root p {
          margin: 0;
        }

        .geo-trouve-title {
          font-size: 20px;
        }

        .geo-trouve-text-hint {
          font-size: 40px;
        }

        .geo-trouve-icon-hint {
          font-size: 40px;
        }

        .geo-trouve-distance {
          font-size: 16px;
        }

        .geo-trouve-debug {
          font-size: 16px;
          font-family: monospace;
        }

        /* Animation from https://codepen.io/chrisunderdown/pen/JeXNoz */
        .geo-trouve-circle {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          aspect-ratio: 1 / 1;
          padding: 50px;
          border-radius: 100%;
          background: #ffffff;
          box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.25);
        }

        .geo-trouve-circle::before,
        .geo-trouve-circle::after {
          opacity: 0;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          position: absolute;
          top: -8px;
          left: -8px;
          right: 0;
          bottom: 0;
          content: "";
          height: 100%;
          width: 100%;
          border: 8px solid rgba(0, 0, 0, 0.2);
          border-radius: 100%;
          animation-name: geo-trouve-ripple;
          animation-duration: 3s;
          animation-delay: 0s;
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(0.65, 0, 0.34, 1);
          z-index: -1;
        }

        .geo-trouve-circle::before {
          animation-delay: 0.5s;
        }

        @keyframes geo-trouve-ripple {
          from {
            opacity: 1;
            transform: scale3d(0.75, 0.75, 1);
          }

          to {
            opacity: 0;
            transform: scale3d(1.5, 1.5, 1);
          }
        }

        .geo-trouve-angle-semi-circle {
          position: absolute;
          top: 0;
          bottom: 50%;
          right: 0;
          left: 0;
          border: blue solid 5px;
          border-radius: 999px 999px 0 0;
          border-bottom: none;
          transform-origin: bottom;
          opacity: 0.2;
        }
      </style>`;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // INPUTS
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // These are reflected properties, to handle changes after component initialization
      // see https://blog.ltgt.net/web-component-properties/
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      get title() {
        return (
          this.getAttribute("title") ??
          new URLSearchParams(window.location.search).get("title")
        );
      }

      get targetLatitude() {
        return (
          this.getAttribute("latitude") ??
          new URLSearchParams(window.location.search).get("latitude")
        );
      }

      get targetLongitude() {
        return (
          this.getAttribute("longitude") ??
          new URLSearchParams(window.location.search).get("longitude")
        );
      }

      get listId() {
        return (
          this.getAttribute("listId") ??
          new URLSearchParams(window.location.search).get("listId")
        );
      }

      get showDebugInfo() {
        return (
          this.hasAttribute("debug") ??
          new URLSearchParams(window.location.search).get("debug")
        );
      }

      get question() {
        return (
          this.getAttribute("question") ??
          new URLSearchParams(window.location.search).get("question")
        );
      }

      get reponses() {
        const reponses = [];

        for (let reponseNumber = 1; reponseNumber; reponseNumber++) {
          const reponse =
            this.getAttribute(`reponse-${reponseNumber}`) ??
            new URLSearchParams(window.location.search).get(
              `reponse-${reponseNumber}`
            );
          if (reponse) {
            reponses.push(reponse);
          } else {
            break;
          }
        }

        return reponses;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // SETUP
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      connectedCallback() {
        //--------------------------------------------------------------------------------------------------------------
        // Initial conditions and render
        //--------------------------------------------------------------------------------------------------------------
        this.previousLastPositionUpdate = new Date().getTime();
        this.previousLastDisplayUpdate = this.previousLastPositionUpdate;
        this.previousLatitude = this.targetLatitude;
        this.previousLongitude = this.targetLongitude;
        this.previousDistanceInverseVincenty = 0;
        this.initialRender();

        //--------------------------------------------------------------------------------------------------------------
        // Start monitoring position
        //--------------------------------------------------------------------------------------------------------------
        this.start();
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // INITIAL RENDER
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      initialRender() {
        this.innerHTML = html`
          ${this.STYLE}
          <div class="geo-trouve-root">
            ${this.title
              ? html`<div class="geo-trouve-title">${this.title ?? ""}</div>`
              : ""}
            ${this.listId
              ? html`<a href="geo-trouve-list?listId=${this.listId}"
                  >Revenir à la liste</a
                >`
              : ""}
            <div class="geo-trouve-circle">
              <p class="geo-trouve-text-hint">C'est parti !</p>
              <p class="geo-trouve-icon-hint">🚀</p>
              <p class="geo-trouve-distance">Commence à te déplacer</p>
              <p class="geo-trouve-angle-semi-circle"></p>
            </div>
          </div>
          ${this.showDebugInfo
            ? html`<details>
                <summary>
                  <div>DEBUG</div>
                </summary>
                <div class="geo-trouve-debug">-- INPUT --</div>
                <div class="geo-trouve-debug geo-trouve-debug-target-position">
                  Target position : Lat=${this.targetLatitude}
                  Lon=${this.targetLongitude}
                </div>
                <div class="geo-trouve-debug">Question=${this.question}</div>
                <div class="geo-trouve-debug">
                  Réponses=${this.reponses.join(",")}
                </div>
                <div class="geo-trouve-debug">-- MESURES --</div>
                <div
                  class="geo-trouve-debug geo-trouve-debug-current-position"
                ></div>
                <div
                  class="geo-trouve-debug geo-trouve-debug-previous-distance"
                ></div>
              </details>`
            : ""}
        `;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // START MONITORING POSITION
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      start() {
        //--------------------------------------------------------------------------------------------------------------
        // Enable geolocation on device
        //--------------------------------------------------------------------------------------------------------------
        if ("geolocation" in navigator) {
          // TODO vérifier que la geolocation est activée

          //--------------------------------------------------------------------------------------------------------------
          // Keep the screen on
          //--------------------------------------------------------------------------------------------------------------
          // https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
          if ("wakeLock" in navigator) {
            console.log("Screen Wake Lock API supported!");
            let wakeLock = null;
            try {
              function acquireWakeLock() {
                navigator.wakeLock
                  .request("screen")
                  .then((acquiredWakeLock) => {
                    console.log("Wake Lock is active!");
                    wakeLock = acquiredWakeLock;

                    document.addEventListener("visibilitychange", async () => {
                      if (
                        wakeLock !== null &&
                        document.visibilityState === "visible"
                      ) {
                        acquireWakeLock();
                      }
                    });
                  });
              }
              acquireWakeLock();
            } catch (err) {
              // The Wake Lock request has failed - usually system related, such as battery.
              console.log(`Wake lock error: ${err.name}, ${err.message}`);
            }
          } else {
            console.log("Wake lock is not supported by this browser.");
          }

          //--------------------------------------------------------------------------------------------------------------
          // Start listening GPS position
          //--------------------------------------------------------------------------------------------------------------
          navigator.geolocation.watchPosition(
            this.onPositionUpdated.bind(this),
            this.onError.bind(this),
            this.GEOLOCATION_OPTIONS
          );
        } else {
          //--------------------------------------------------------------------------------------------------------------
          // Explain that geolocation is not available
          //--------------------------------------------------------------------------------------------------------------
          alert(`geolocation IS NOT available`);
        }
      }

      onError(error) {
        console.error(error);
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // WHEN POSITION IS UPDATED
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      onPositionUpdated(position) {
        //--------------------------------------------------------------------------------------------------------------
        // Extract new position
        //--------------------------------------------------------------------------------------------------------------
        const lastPositionUpdate = new Date().getTime();
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        //--------------------------------------------------------------------------------------------------------------
        // Compute the new distance
        //--------------------------------------------------------------------------------------------------------------
        const distanceInverseVincenty = this.inverseVincentyDistance(
          latitude,
          longitude,
          this.targetLatitude,
          this.targetLongitude
        );

        //--------------------------------------------------------------------------------------------------------------
        // Compute the angle between old and new coordinates
        //--------------------------------------------------------------------------------------------------------------
        const angle = this.angleFromCoordinate(
          latitude,
          longitude,
          this.targetLatitude,
          this.targetLongitude
        );

        //--------------------------------------------------------------------------------------------------------------
        // Update debug infos
        //--------------------------------------------------------------------------------------------------------------
        if (this.showDebugInfo) {
          document.querySelector(
            ".geo-trouve-debug-previous-distance"
          ).textContent = `Ancienne distance : ${this.previousDistanceInverseVincenty} m`;
          document.querySelector(
            ".geo-trouve-debug-current-position"
          ).textContent = `Position : Lat=${latitude} Lon=${longitude}`;
          document.querySelector(
            ".geo-trouve-debug-target-position"
          ).textContent = `Target position : Lat=${this.targetLatitude} Lon=${this.targetLongitude}`;
        }

        //--------------------------------------------------------------------------------------------------------------
        // Check if we should update the information displayed
        //--------------------------------------------------------------------------------------------------------------
        const shouldUpdateDisplay =
          lastPositionUpdate - this.previousLastDisplayUpdate >
          this.DISPLAY_UPDATE_INTERVAL;
        if (shouldUpdateDisplay) {
          //--------------------------------------------------------------------------------------------------------------
          // Update the distance
          //--------------------------------------------------------------------------------------------------------------
          document.querySelector(
            ".geo-trouve-distance"
          ).textContent = `Distance: ${Math.round(distanceInverseVincenty)} m`;

          //--------------------------------------------------------------------------------------------------------------
          // Check if we are next to the target or not
          //--------------------------------------------------------------------------------------------------------------
          const isOnTarget = distanceInverseVincenty < this.IS_ON_TARGET_RANGE;
          if (isOnTarget) {
            //--------------------------------------------------------------------------------------------------------------
            // Show that we are arrived
            //--------------------------------------------------------------------------------------------------------------
            document.querySelector(".geo-trouve-icon-hint").textContent = "🎯";
            document.querySelector(".geo-trouve-text-hint").textContent =
              "C'est ici !";
            document.querySelector(
              ".geo-trouve-angle-semi-circle"
            ).style.transform = `rotate(0deg)`;
            //--------------------------------------------------------------------------------------------------------------
            // Show the question
            //--------------------------------------------------------------------------------------------------------------
            // TODO afficher la question quand on est proche de la cible
          } else {
            //--------------------------------------------------------------------------------------------------------------
            // Update the game hint
            //--------------------------------------------------------------------------------------------------------------
            const hasNotMovedEnough =
              Math.abs(
                distanceInverseVincenty - this.previousDistanceInverseVincenty
              ) < 5;

            if (hasNotMovedEnough) {
              document.querySelector(".geo-trouve-icon-hint").textContent =
                "🏃";
              document.querySelector(".geo-trouve-text-hint").textContent =
                "Déplace-toi";
            } else {
              const isCloser =
                distanceInverseVincenty - this.previousDistanceInverseVincenty <
                0;

              if (isCloser) {
                document.querySelector(".geo-trouve-icon-hint").textContent =
                  "🔥";
                document.querySelector(".geo-trouve-text-hint").textContent =
                  "Tu chauffes";
              } else {
                document.querySelector(".geo-trouve-icon-hint").textContent =
                  "❄️";
                document.querySelector(".geo-trouve-text-hint").textContent =
                  "Tu refroidis";
              }
            }

            document.querySelector(
              ".geo-trouve-angle-semi-circle"
            ).style.transform = `rotate(${angle}deg)`;
          }

          //--------------------------------------------------------------------------------------------------------------
          // Store the current position for the next time
          //--------------------------------------------------------------------------------------------------------------
          this.previousLastPositionUpdate = lastPositionUpdate;
          this.previousLastDisplayUpdate = this.previousLastPositionUpdate;
          this.previousLatitude = latitude;
          this.previousLongitude = longitude;
          this.previousDistanceInverseVincenty = distanceInverseVincenty;
        }
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // DISTANCE COMPUTATION
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // Use inverse Vincenty distance formula
      // see https://www.jameslmilner.com/posts/measuring-the-world-with-javascript/
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      inverseVincentyDistance(latitude1, longitude1, latitude2, longitude2) {
        const toRadians = (latOrLng) => (latOrLng * Math.PI) / 180;

        const phiOne = toRadians(latitude1);
        const lambda1 = toRadians(longitude1);
        const phiTwo = toRadians(latitude2);
        const lambda2 = toRadians(longitude2);

        const wgs84ellipsoid = {
          a: 6378137,
          b: 6356752.314245,
          f: 1 / 298.257223563,
        };
        const { a, b, f } = wgs84ellipsoid;

        const L = lambda2 - lambda1; // L = difference in longitude, U = reduced latitude, defined by tan U = (1-f)·tanphi.
        const tanU1 = (1 - f) * Math.tan(phiOne),
          cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1),
          sinU1 = tanU1 * cosU1;
        const tanU2 = (1 - f) * Math.tan(phiTwo),
          cosU2 = 1 / Math.sqrt(1 + tanU2 * tanU2),
          sinU2 = tanU2 * cosU2;

        const antipodal =
          Math.abs(L) > Math.PI / 2 || Math.abs(phiTwo - phiOne) > Math.PI / 2;

        let lambda = L,
          sinLambda = null,
          cosLambda = null; // lambda = difference in longitude on an auxiliary sphere
        let sigma = antipodal ? Math.PI : 0,
          sinSigma = 0,
          cosSigma = antipodal ? -1 : 1,
          sinSqsigma = null; // sigma = angular distance P₁ P₂ on the sphere
        let cos2sigmaM = 1; // sigmaM = angular distance on the sphere from the equator to the midpoint of the line
        let sinalpha = null,
          cosSqAlpha = 1; // alpha = azimuth of the geodesic at the equator
        let C = null;

        let lambdaʹ = null,
          iterations = 0;
        do {
          sinLambda = Math.sin(lambda);
          cosLambda = Math.cos(lambda);
          sinSqsigma =
            cosU2 * sinLambda * (cosU2 * sinLambda) +
            (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
              (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);

          if (Math.abs(sinSqsigma) < Number.EPSILON) {
            break; // co-incident/antipodal points (falls back on lambda/sigma = L)
          }

          sinSigma = Math.sqrt(sinSqsigma);
          cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
          sigma = Math.atan2(sinSigma, cosSigma);
          sinalpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
          cosSqAlpha = 1 - sinalpha * sinalpha;
          cos2sigmaM =
            cosSqAlpha != 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0; // on equatorial line cos²alpha = 0 (§6)
          C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
          lambdaʹ = lambda;
          lambda =
            L +
            (1 - C) *
              f *
              sinalpha *
              (sigma +
                C *
                  sinSigma *
                  (cos2sigmaM +
                    C * cosSigma * (-1 + 2 * cos2sigmaM * cos2sigmaM)));
          const iterationCheck = antipodal
            ? Math.abs(lambda) - Math.PI
            : Math.abs(lambda);
          if (iterationCheck > Math.PI) {
            throw new Error("lambda > Math.PI");
          }
        } while (Math.abs(lambda - lambdaʹ) > 1e-12 && ++iterations < 1000);
        if (iterations >= 1000) {
          throw new Error("Vincenty formula failed to converge");
        }

        const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
        const A =
          1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
        const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
        const deltaSigma =
          B *
          sinSigma *
          (cos2sigmaM +
            (B / 4) *
              (cosSigma * (-1 + 2 * cos2sigmaM * cos2sigmaM) -
                (B / 6) *
                  cos2sigmaM *
                  (-3 + 4 * sinSigma * sinSigma) *
                  (-3 + 4 * cos2sigmaM * cos2sigmaM)));

        const distance = b * A * (sigma - deltaSigma); // distance = length of the geodesic

        return distance;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // ANGLE BETWEEN TWO COORDINATES COMPUTATION
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // see https://stackoverflow.com/a/18738281
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      angleFromCoordinate(latitude1, longitude1, latitude2, longitude2) {
        const dLon = longitude2 - longitude1;

        const y = Math.sin(dLon) * Math.cos(latitude2);
        const x =
          Math.cos(latitude1) * Math.sin(latitude2) -
          Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(dLon);

        let bearing = Math.atan2(y, x);
        bearing = this.toDegrees(bearing);
        bearing = (bearing + 360) % 360;
        bearing = 360 - bearing; // count degrees counter-clockwise - remove to make clockwise

        return bearing;
      }
      toDegrees(angleInRadians) {
        return (angleInRadians * 180) / Math.PI;
      }
    }
  );
}
