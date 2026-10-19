/** Tiny hyperscript helper — the apps render plain DOM, re-built on every state change. */
export type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: Partial<CSSStyleDeclaration> | string };

const PROPERTY_KEYS = new Set(["value", "checked", "disabled", "selected", "required", "readOnly", "multiple", "min", "max", "type", "name", "placeholder", "rows", "autocomplete", "loading", "muted", "controls", "autoplay", "preload", "src", "href", "alt", "target", "rel", "title"]);

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false && !PROPERTY_KEYS.has(key)) continue;
    if (key === "class") node.className = String(value);
    else if (key === "style") {
      if (typeof value === "string") node.setAttribute("style", value);
      else Object.assign(node.style, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (PROPERTY_KEYS.has(key)) {
      (node as unknown as Record<string, unknown>)[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  append(node, children);
  return node;
}

function append(parent: Node, children: Child[]) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function button(label: Child, onClick: (event: Event) => void, className = "btn", extra: Props = {}) {
  return h("button", { type: "button", class: className, onClick, ...extra }, label);
}

/** An avatar image, or the person's initials when they have no photo. */
export function avatar(name: unknown, url: unknown, className = "avatar") {
  if (typeof url === "string" && url) return h("img", { class: className, src: url, alt: "", loading: "lazy" });
  const initials = String(name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return h("span", { class: `${className} avatar-initials`, "aria-hidden": "true" }, initials || "?");
}

export function firstName(name: unknown) {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function isVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function emptyState(title: string, detail?: string, action?: HTMLElement) {
  return h("div", { class: "empty" }, h("strong", null, title), detail ? h("span", null, detail) : null, action ?? null);
}
