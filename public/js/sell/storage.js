var Storage = function (storageKey) {
    this.key = storageKey;
    this.prefs = $.localStorage.get(this.key);
};

Storage.prototype.get = function (k) {
    return this.prefs ? this.prefs[k] : null;
};

Storage.prototype.set = function (k,v) {
    this.prefs = this.prefs || {};
    this.prefs[k] = v;
    $.localStorage.set(this.key, this.prefs);
};

module.exports = Storage;
