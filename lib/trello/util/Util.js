const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
* Contains various general-purpose utility methods.
*/
class Util {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
  * Shallow-copies an object with its class/prototype intact.
  * @param {Object} obj Object to clone
  * @returns {Object}
  * @private
  */
  static cloneObject(obj) {
    return Object.assign(Object.create(obj), obj);
  }

  /**
  * Sets default properties on an object that aren't already specified.
  * @param {Object} def Default properties
  * @param {Object} given Object to assign defaults to
  * @returns {Object}
  * @private
  */
  static mergeDefault(def, given) {
    if (!given) return def;
    for (const key in def) {
      if (!has(given, key) || given[key] === undefined) {
        given[key] = def[key];
      } else if (given[key] === Object(given[key])) {
        given[key] = Util.mergeDefault(def[key], given[key]);
      }
    }

    return given;
  }

  /**
  * Creates a Promise that resolves after a specified duration.
  * @param {number} ms How long to wait before resolving (in milliseconds)
  * @returns {Promise<void>}
  * @private
  */
  static delayFor(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

module.exports = Util;
