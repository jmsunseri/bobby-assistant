function Clay(config, customFn) {
  this.config = config;
  this.customFn = customFn;
}
Clay.prototype.on = function() { return this; };
Clay.prototype.onOpen = function() { return this; };
Clay.prototype.onMessage = function() { return this; };
module.exports = Clay;