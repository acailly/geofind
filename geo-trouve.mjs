import html from "./html-tag.mjs";

if (!customElements.get("geo-trouve")) {
  customElements.define(
    "geo-trouve",
    class extends HTMLElement {
      IS_ON_TARGET_RANGE = 20;
      DISPLAY_UPDATE_INTERVAL = 3000;

      connectedCallback() {
        // GET INPUT PARAMS
        this.targetLatitude = this.getAttribute("latitude");
        this.targetLongitude = this.getAttribute("longitude");
        this.question = this.getAttribute("question");
        this.reponses = [];

        for (let reponseNumber = 1; reponseNumber; reponseNumber++) {
          const reponse = this.getAttribute(`reponse-${reponseNumber}`);
          if (reponse) {
            this.reponses.push(reponse);
          } else {
            break;
          }
        }

        // SETUP INITIAL CONDITIONS
        this.previousLastPositionUpdate = new Date().getTime();
        this.previousLastDisplayUpdate = this.previousLastPositionUpdate;
        this.previousLatitude = this.targetLatitude;
        this.previousLongitude = this.targetLongitude;
        this.previousDistanceInverseVincenty = 0;

        this.innerHTML = html`
          <style>
            .geo-trouve-root {
              /* from https://systemfontstack.com/ */
              font-family: -apple-system, BlinkMacSystemFont, avenir next,
                avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu,
                roboto, noto, arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 20px;
            }

            .geo-trouve-root p {
              margin: 0;
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
          </style>
          <div class="geo-trouve-root">
            <div class="geo-trouve-circle">
              <p class="geo-trouve-text-hint">C'est parti !</p>
              <p class="geo-trouve-icon-hint">🚀</p>
              <p class="geo-trouve-distance">Commence à te déplacer</p>
            </div>
          </div>
          <details>
            <summary>
              <div>DEBUG</div>
            </summary>
            <div class="geo-trouve-debug">-- INPUT --</div>
            <div class="geo-trouve-debug">
              Target: Lat=${this.targetLatitude}, Lon=${this.targetLongitude}
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
          </details>
        `;

        this.start();
      }

      start() {
        if ("geolocation" in navigator) {
          const success = (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            this.positionUpdated(latitude, longitude);
          };

          const error = (error) => {
            console.error(error);
          };

          // see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition#options
          const options = {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 27000,
          };

          navigator.geolocation.watchPosition(success, error, options);
        } else {
          alert(`geolocation IS NOT available`);
        }
      }

      positionUpdated(latitude, longitude) {
        const lastPositionUpdate = new Date().getTime();

        const shouldUpdateDisplay =
          lastPositionUpdate - this.previousLastDisplayUpdate >
          this.DISPLAY_UPDATE_INTERVAL;

        // Distance
        const distanceInverseVincenty = this.inverseVincentyDistance(
          latitude,
          longitude,
          this.targetLatitude,
          this.targetLongitude
        );
        if (shouldUpdateDisplay) {
          document.querySelector(
            ".geo-trouve-distance"
          ).textContent = `Distance: ${Math.round(distanceInverseVincenty)} m`;
          // DEBUG
          document.querySelector(
            ".geo-trouve-debug-previous-distance"
          ).textContent = `Ancienne distance : ${this.previousDistanceInverseVincenty} m`;
          document.querySelector(
            ".geo-trouve-debug-current-position"
          ).textContent = `Position : Lat=${latitude} Lon=${longitude}`;

          // Game Hint
          const isOnTarget = distanceInverseVincenty < this.IS_ON_TARGET_RANGE;
          if (isOnTarget) {
            document.querySelector(".geo-trouve-icon-hint").textContent = "🎯";
            document.querySelector(".geo-trouve-text-hint").textContent =
              "C'est ici !";
            // TODO afficher la question quand on est proche de la cible
          } else {
            const isCloser =
              distanceInverseVincenty - this.previousDistanceInverseVincenty <
              0;

            document.querySelector(".geo-trouve-icon-hint").textContent =
              isCloser ? "🔥" : "❄️";
            document.querySelector(".geo-trouve-text-hint").textContent =
              isCloser ? "Tu chauffes" : "Tu refroidis";
          }

          // Previous measure
          this.previousLastPositionUpdate = lastPositionUpdate;
          this.previousLastDisplayUpdate = this.previousLastPositionUpdate;
          this.previousLatitude = latitude;
          this.previousLongitude = longitude;
          this.previousDistanceInverseVincenty = distanceInverseVincenty;
        }
      }

      // https://www.jameslmilner.com/posts/measuring-the-world-with-javascript/
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
    }
  );
}
