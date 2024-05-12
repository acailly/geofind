/**
 * @param {TemplateStringsArray} texts
 * @param  {...any} vars
 * @returns {string}
 */
function html(texts, ...vars) {
  let result = texts[0];

  for (let textIndex = 1; textIndex < texts.length; textIndex++) {
    result += vars[textIndex - 1];
    result += texts[textIndex];
  }

  return result;
}

export default html;
