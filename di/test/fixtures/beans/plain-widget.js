const {Injectable} = require("../../../src/decorators");

class PlainWidget {
    name = "plain-widget";
}
Injectable()(PlainWidget);

module.exports = {PlainWidget};
