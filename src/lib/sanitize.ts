import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b",
  "i",
  "em",
  "strong",
  "u",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "img",
  "mark",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "pre",
  "code",
  "a",
  "sub",
  "sup",
];

const ALLOWED_ATTR = ["src", "alt", "href", "target", "rel", "style", "class", "data-path"];

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
