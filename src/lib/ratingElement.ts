// A real custom element, <ol-rating>, defined in the reader's browser. Its attributes choose
// how it's built, so the demo can show what really happens:
//   shadow="open" | "none"     render into a shadow root, or straight into the light DOM
//   composed="true" | "false"  whether its rating-change event crosses the shadow boundary
//   form-value="true" | "false"  whether it reports a value to its <form> (form-associated;
//                              "form" itself is reserved: it names the owning form by id)
// It logs its lifecycle callbacks through a "ol-rating-log" event on document.

export const TAG = "ol-rating";

export function defineRating() {
  if (typeof window === "undefined" || customElements.get(TAG)) return;
  const log = (what: string) => document.dispatchEvent(new CustomEvent("ol-rating-log", { detail: what }));

  class Rating extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ["value"];
    internals: ElementInternals;
    root: ShadowRoot | HTMLElement | null = null;

    constructor() {
      super();
      this.internals = this.attachInternals();
      log("constructor()");
    }

    get value() {
      return Number(this.getAttribute("value") ?? 0);
    }

    connectedCallback() {
      log("connectedCallback()");
      if (!this.root) {
        if (this.getAttribute("shadow") === "open") {
          const shadow = this.attachShadow({ mode: "open" });
          shadow.innerHTML = `<style>
            :host { display: inline-flex; align-items: center; gap: 6px; }
            button { font: inherit; font-size: 20px; line-height: 1; padding: 4px 6px; min-height: 44px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--star-color, #888); cursor: pointer; }
            button[aria-pressed="true"] { color: var(--star-on, #f5a623); }
          </style><slot></slot><span class="stars"></span>`;
          this.root = shadow;
        } else {
          // No shadow root: the stars sit in the light DOM, next to whatever the page put inside.
          const span = document.createElement("span");
          span.className = "stars";
          this.append(span);
          this.root = this;
        }
      }
      this.render();
    }

    disconnectedCallback() {
      log("disconnectedCallback()");
    }

    attributeChangedCallback(name: string, oldValue: string | null, value: string | null) {
      log(`attributeChangedCallback("${name}", ${JSON.stringify(oldValue)}, ${JSON.stringify(value)})`);
      if (this.root) this.render();
    }

    render() {
      const stars = this.root!.querySelector(".stars")!;
      stars.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "star";
        b.setAttribute("part", "star");
        b.setAttribute("aria-label", `${i} star${i === 1 ? "" : "s"}`);
        b.setAttribute("aria-pressed", String(i <= this.value));
        b.textContent = i <= this.value ? "★" : "☆";
        b.addEventListener("click", () => {
          // Dispatch before re-rendering: setting value rebuilds the stars and detaches this one.
          b.dispatchEvent(new CustomEvent("rating-change", { detail: i, bubbles: true, composed: this.getAttribute("composed") === "true" }));
          this.setAttribute("value", String(i));
        });
        stars.append(b);
      }
      this.internals.setFormValue(this.getAttribute("form-value") === "true" ? String(this.value) : null);
    }
  }

  customElements.define(TAG, Rating);
}
