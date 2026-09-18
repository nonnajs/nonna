const {Injectable} = require("../../src/decorators");

class DecoratedWidget {
    name = "decorated-widget";
}
Injectable()(DecoratedWidget);

module.exports = {DecoratedWidget};
