"use strict";

const { printComments } = require("../../main/comments");
const { printString, printNumber } = require("../../common/util");
const {
  isNumericLiteral,
  isSimpleNumber,
  isStringLiteral,
  isStringPropSafeToUnquote,
  rawText,
} = require("../utils");
const { printAssignment } = require("./assignment");

const needsQuoteProps = new WeakMap();

function printPropertyKey(path, options, print) {
  const node = path.getNode();

  if (node.computed) {
    return ["[", path.call(print, "key"), "]"];
  }

  const parent = path.getParentNode();
  const { key } = node;

  if (
    node.type === "ClassPrivateProperty" &&
    // flow has `Identifier` key, and babel has `PrivateName` key
    key.type === "Identifier"
  ) {
    return ["#", path.call(print, "key")];
  }

  if (options.quoteProps === "consistent" && !needsQuoteProps.has(parent)) {
    const objectHasStringProp = (
      parent.properties ||
      parent.body ||
      parent.members
    ).some(
      (prop) =>
        !prop.computed &&
        prop.key &&
        isStringLiteral(prop.key) &&
        !isStringPropSafeToUnquote(prop, options)
    );
    needsQuoteProps.set(parent, objectHasStringProp);
  }

  if (
    (key.type === "Identifier" ||
      (isNumericLiteral(key) &&
        isSimpleNumber(printNumber(rawText(key))) &&
        // Avoid converting 999999999999999999999 to 1e+21, 0.99999999999999999 to 1 and 1.0 to 1.
        String(key.value) === printNumber(rawText(key)) &&
        // Quoting number keys is safe in JS and Flow, but not in TypeScript (as
        // mentioned in `isStringPropSafeToUnquote`).
        !(options.parser === "typescript" || options.parser === "babel-ts"))) &&
    (options.parser === "json" ||
      (options.quoteProps === "consistent" && needsQuoteProps.get(parent)))
  ) {
    // a -> "a"
    // 1 -> "1"
    // 1.5 -> "1.5"
    const prop = printString(
      JSON.stringify(
        key.type === "Identifier" ? key.name : key.value.toString()
      ),
      options
    );
    return path.call(
      (keyPath) => printComments(keyPath, () => prop, options),
      "key"
    );
  }

  if (
    isStringPropSafeToUnquote(node, options) &&
    (options.quoteProps === "as-needed" ||
      (options.quoteProps === "consistent" && !needsQuoteProps.get(parent)))
  ) {
    // 'a' -> a
    // '1' -> 1
    // '1.5' -> 1.5
    return path.call(
      (keyPath) =>
        printComments(
          keyPath,
          () => (/^\d/.test(key.value) ? printNumber(key.value) : key.value),
          options
        ),
      "key"
    );
  }

  return path.call(print, "key");
}

function printProperty(path, options, print) {
  const n = path.getValue();
  if (n.shorthand) {
    return path.call(print, "value");
  }

  return printAssignment(
    n.key,
    printPropertyKey(path, options, print),
    ":",
    n.value,
    path.call(print, "value"),
    options
  );
}

module.exports = { printProperty, printPropertyKey };
