define("cde/components/Map/Map.lifecycle", ["amd!cdf/lib/underscore"], function (_) {
  return {
    maybeToggleBlock: function (block) {
      this.isSilent() || (block ? this.block() : this.unblock());
    },
    getQueryData: function () {
      var query = this.queryState = this.query = this.dashboard.getQuery(this.queryDefinition);
      query.setAjaxOptions({
        async: !0
      }), query.fetchData(this.parameters, this.getSuccessHandler(_.bind(this.onDataReady, this)), this.getErrorHandler());
    },
    _concludeUpdate: function () {
      this.postExec(), this.maybeToggleBlock(!1);
    }
  };
}), define("cde/components/Map/Map.selector", [], function () {
  return {
    getValue: function () {
      var selectedItems = this.model.leafs().filter(function (m) {
        return m.getSelection() === !0;
      }).map(function (m) {
        return m.get("id");
      }).value();
      return selectedItems;
    },
    setValue: function (idList) {
      if (!this.model) throw "Model is not initialized";
      return this.model.setSelectedItems(idList), this;
    },
    updateSelection: function () {
      var idList = this.dashboard.getParameterValue(this.parameter);
      this.setValue(idList);
    },
    processChange: function () {
      return this.dashboard.processChange(this.name), this;
    }
  };
}), define("cde/components/Map/model/MapModel", ["cdf/lib/BaseSelectionTree", "amd!cdf/lib/underscore", "cdf/lib/jquery"], function (BaseSelectionTree, _, $) {
  function getStyle(config, mode, state, action) {
    var styleKeywords = [_.values(ACTIONS), _.values(STATES), _.values(MODES)], desiredKeywords = _.map(styleKeywords, function (list, idx) {
      return _.intersection(list, [[action || "", state || "", mode || ""][idx]])[0];
    });
    return computeStyle(config, desiredKeywords);
  }

  function computeStyle(config, desiredKeywords) {
    var plainStyle = {}, compoundStyle = {};
    _.each(config, function (value, key) {
      _.isObject(value) ? compoundStyle[key] = value : plainStyle[key] = value;
    });
    var style = _.reduce(compoundStyle, function (memo, value, key) {
      return _.each(desiredKeywords, function (keyword) {
        keyword === key && $.extend(!0, memo, computeStyle(value, desiredKeywords));
      }), memo;
    }, plainStyle);
    return style;
  }

  var MODES = {
    pan: "pan",
    zoombox: "zoombox",
    selection: "selection"
  }, STATES = {
    selected: "selected",
    unselected: "unselected"
  }, ACTIONS = {
    normal: "normal",
    hover: "hover"
  }, FEATURE_TYPES = {
    shapes: "shape",
    markers: "marker"
  }, SelectionStates = BaseSelectionTree.SelectionStates;
  return BaseSelectionTree.extend({
    defaults: {
      id: void 0,
      label: "",
      isSelected: !1,
      isHighlighted: !1,
      isVisible: !0,
      numberOfSelectedItems: 0,
      numberOfItems: 0,
      rawData: null,
      styleMap: {}
    },
    constructor: function () {
      this.base.apply(this, arguments), this.isRoot() && this.setPanningMode();
    },
    setPanningMode: function () {
      return this.isSelectionMode() && this.trigger("selection:complete"), this.root().set("mode", MODES.pan),
        this;
    },
    setZoomBoxMode: function () {
      return this.root().set("mode", MODES.zoombox), this;
    },
    setSelectionMode: function () {
      return this.root().set("mode", MODES.selection), this;
    },
    getMode: function () {
      return this.root().get("mode");
    },
    isPanningMode: function () {
      return this.root().get("mode") === MODES.pan;
    },
    isZoomBoxMode: function () {
      return this.root().get("mode") === MODES.zoombox;
    },
    isSelectionMode: function () {
      return this.root().get("mode") === MODES.selection;
    },
    isHover: function () {
      return this.get("isHighlighted") === !0;
    },
    setHover: function (bool) {
      return this.set("isHighlighted", bool === !0);
    },
    _getStyle: function (mode, state, action) {
      var parentStyle, myStyleMap = this.get("styleMap");
      return parentStyle = this.parent() ? this.parent()._getStyle(mode, state, action) : {},
        $.extend(!0, getStyle(parentStyle, mode, state, action), getStyle(myStyleMap, mode, state, action));
    },
    getStyle: function () {
      var mode = this.root().get("mode"), state = this.getSelection() === SelectionStates.ALL ? STATES.selected : STATES.unselected, action = this.isHover() === !0 ? ACTIONS.hover : ACTIONS.normal;
      return this._getStyle(mode, state, action);
    },
    getFeatureType: function () {
      return FEATURE_TYPES[this._getParents([])[1]];
    },
    _getParents: function (list) {
      return list.unshift(this.get("id")), this.parent() ? this.parent()._getParents(list) : list;
    }
  }, {
    Modes: MODES,
    States: STATES,
    Actions: ACTIONS,
    FeatureTypes: FEATURE_TYPES,
    SelectionStates: BaseSelectionTree.SelectionStates
  });
}), define("cde/components/Map/_getMapping", ["amd!cdf/lib/underscore"], function (_) {
  function getMapping(json) {
    var map = {};
    if (!json.metadata || 0 == json.metadata.length) return map;
    var colToPropertyMapping = {
      key: "id",
      id: "id",
      fill: "fill",
      fillColor: "fill",
      r: "r",
      latitude: "latitude",
      longitude: "longitude",
      address: "address",
      description: "description",
      marker: "marker",
      markerwidth: "markerWidth",
      markerheight: "markerHeight",
      popupcontents: "popupContents",
      popupwidth: "popupWidth",
      popupheight: "popupHeight"
    }, colNames = _.chain(json.metadata).pluck("colName").map(function (s) {
      return s.toLowerCase();
    }).value(), map = _.chain(colNames).map(function (colName, idx) {
      var property = colToPropertyMapping[colName];
      return property ? [property, idx] : [colName, idx];
    }).compact().object().value();
    return ("latitude" in map || "longitude" in map) && (map.addressType = "coordinates"),
    "address" in map && !map.addressType && (map.addressType = "address"), map.id || (map.id = 0),
      map;
  }

  return getMapping;
}), define("cde/components/Map/FeatureStore/shapeConversion", [], function () {
  return {
    simplifyPoints: function (points, precision_m) {
      function properRDP(points, epsilon) {
        var firstPoint = points[0], lastPoint = points[points.length - 1];
        if (points.length < 3) return points;
        for (var index = -1, dist = 0, i = 1; i < points.length - 1; i++) {
          var cDist = findPerpendicularDistance(points[i], firstPoint, lastPoint);
          cDist > dist && (dist = cDist, index = i);
        }
        if (dist > epsilon) {
          var l1 = points.slice(0, index + 1), l2 = points.slice(index), r1 = properRDP(l1, epsilon), r2 = properRDP(l2, epsilon), rs = r1.slice(0, r1.length - 1).concat(r2);
          return rs;
        }
        return [firstPoint, lastPoint];
      }

      function findPerpendicularDistance(p, p1, p2) {
        var result, slope, intercept;
        return p1[0] == p2[0] ? result = Math.abs(p[0] - p1[0]) : (slope = (p2[1] - p1[1]) / (p2[0] - p1[0]),
          intercept = p1[1] - slope * p1[0], result = Math.abs(slope * p[0] - p[1] + intercept) / Math.sqrt(Math.pow(slope, 2) + 1)),
          result;
      }

      return 0 > precision_m ? points : properRDP(points, precision_m / 63e5);
    },
    exportShapeDefinition: function () {
      this.shapeDefinition && window.open("data:text/json;charset=utf-8," + escape(JSON.stringify(this.shapeDefinition)));
    }
  };
}), define("cde/components/Map/FeatureStore/resolveShapes", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "./shapeConversion"], function ($, _, ShapeConversion) {
  function resolveShapes(json, mapping, configuration) {
    var addIn = this.getAddIn("ShapeResolver", configuration.addIns.ShapeResolver.name), url = configuration.addIns.ShapeResolver.options.url;
    !addIn && url && (addIn = url.endsWith("json") || url.endsWith("js") ? this.getAddIn("ShapeResolver", "simpleJSON") : this.getAddIn("ShapeResolver", "kml"));
    var deferred = $.Deferred();
    if (!addIn) return deferred.resolve({}), deferred.promise();
    var idList = _.pluck(json.resultset, mapping.id), tgt = this, st = {
      keys: idList,
      ids: idList,
      tableData: json,
      _simplifyPoints: ShapeConversion.simplifyPoints,
      _parseShapeKey: configuration.addIns.ShapeResolver.options.parseShapeKey,
      _shapeSource: url
    }, promise = addIn.call(tgt, st, this.getAddInOptions("ShapeResolver", addIn.getName()));
    return $.when(promise).then(function (result) {
      var shapeDefinitions = _.chain(result).map(function (geoJSONFeature, key) {
        return [key, geoJSONFeature];
      }).object().value();
      deferred.resolve(shapeDefinitions);
    }), deferred.promise();
  }

  return resolveShapes;
}), define("cde/components/Map/FeatureStore/resolveMarkers", ["cdf/lib/jquery", "amd!cdf/lib/underscore"], function ($, _) {
  function resolveMarkers(json, mapping, configuration) {
    var addIn = this.getAddIn("LocationResolver", configuration.addIns.LocationResolver.name), deferred = $.Deferred();
    if (!addIn) return deferred.resolve({}), deferred.promise();
    var markerDefinitions, tgt = this, opts = this.getAddInOptions("LocationResolver", addIn.getName());
    return markerDefinitions = "coordinates" === mapping.addressType ? _.chain(json.resultset).map(function (row) {
      var id = row[mapping.id], location = [row[mapping.longitude], row[mapping.latitude]];
      return [id, createFeatureFromLocation(location)];
    }).object().value() : _.chain(json.resultset).map(function (row, rowIdx) {
      var promisedLocation = $.Deferred(), id = row[mapping.id], address = void 0 != mapping.address ? row[mapping.address] : void 0, st = {
        data: row,
        position: rowIdx,
        address: address,
        addressType: mapping.addressType,
        key: id,
        id: id,
        mapping: mapping,
        tableData: json,
        continuationFunction: function (location) {
          promisedLocation.resolve(createFeatureFromLocation(location));
        }
      }, props = ["country", "city", "county", "region", "state"];
      _.each(_.pick(mapping, props), function (propIdx, prop) {
        void 0 != propIdx && (st[prop] = row[propIdx]);
      });
      try {
        addIn.call(tgt, st, opts);
      } catch (e) {
        promisedLocation.resolve(null);
      }
      return [id, promisedLocation.promise()];
    }).object().value(), deferred.resolve(markerDefinitions), deferred.promise();
  }

  function createFeatureFromLocation(location) {
    var longitude = location[0], latitude = location[1], feature = {
      geometry: {
        coordinates: [longitude, latitude],
        type: "Point",
        properties: {
          latitude: latitude,
          longitude: longitude
        }
      },
      type: "Feature"
    };
    return feature;
  }

  return resolveMarkers;
}), define("cde/components/Map/Map.model", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "cdf/Logger", "./model/MapModel", "./_getMapping", "./FeatureStore/resolveShapes", "./FeatureStore/resolveMarkers"], function ($, _, Logger, MapModel, getMapping, resolveShapes, resolveMarkers) {
  return {
    resolveFeatures: function (json) {
      var mapping = getMapping(json);
      this.mapping = $.extend(!0, mapping, this.visualRoles), this.features = this.features || {};
      var deferred, me = this;
      return deferred = "shapes" === this.mapMode ? this._resolveShapes(json, this.mapping, this.configuration).then(function (shapeDefinition) {
        return me.features.shapes = shapeDefinition, json;
      }) : "markers" === this.mapMode ? this._resolveMarkers(json, this.mapping, this.configuration).then(function (markerDefinitions) {
        return me.features.markers = markerDefinitions, json;
      }) : $.when(json), deferred.promise();
    },
    _resolveShapes: resolveShapes,
    _resolveMarkers: resolveMarkers,
    initModel: function (json) {
      this.model = new MapModel({
        styleMap: this.getStyleMap("global")
      });
      var seriesRoot = this._initSeries(this.mapMode, json);
      json && json.metadata && json.resultset && json.resultset.length > 0 && this._addSeriesToModel(seriesRoot, json);
    },
    _initSeries: function (seriesId, json) {
      var colormap = this.getColorMap(), seriesRoot = {
        id: seriesId,
        label: seriesId,
        styleMap: this.getStyleMap(seriesId),
        colormap: colormap,
        extremes: this._detectExtremes(json)
      };
      return this.model.add(seriesRoot), this.model.findWhere({
        id: seriesId
      });
    },
    visualRoles: {},
    scales: {
      fill: "default",
      r: [10, 20]
    },
    attributeMapping: {
      fill: function (context, seriesRoot, mapping, row, rowIdx) {
        var value = row[mapping.fill], useGradient = context.mode === MapModel.Modes.pan && context.state === MapModel.States.unselected && context.action === MapModel.Actions.normal;
        useGradient = useGradient || context.mode === MapModel.Modes.selection && context.state === MapModel.States.selected && context.action === MapModel.Actions.normal,
          useGradient = !0;
        var colormap = seriesRoot.get("colormap") || this.getColorMap(), isGrayscale = context.mode === MapModel.Modes.selection && context.state === MapModel.States.unselected && context.action === MapModel.Actions.normal;
        return isGrayscale = !1, isGrayscale && (colormap = _.map(colormap, this.toGrayscale)),
          _.isNumber(value) && (useGradient || isGrayscale) ? this.mapColor(value, seriesRoot.get("extremes").fill.min, seriesRoot.get("extremes").fill.max, colormap) : void 0;
      },
      label: function (context, seriesRoot, mapping, row, rowIdx) {
        return _.isEmpty(row) ? void 0 : row[mapping.label] + "";
      },
      r: function (context, seriesRoot, mapping, row, rowIdx) {
        var value = row[mapping.r];
        if (_.isNumber(value)) {
          var rmin = this.scales.r[0], rmax = this.scales.r[1], v = seriesRoot.get("extremes").r, r = Math.sqrt(rmin * rmin + (rmax * rmax - rmin * rmin) * (value - v.min) / (v.max - v.min));
          if (_.isFinite(r)) return r;
        }
      }
    },
    _detectExtremes: function (json) {
      var extremes = _.chain(this.mapping).map(function (colIndex, role) {
        if (!_.isFinite(colIndex)) return [role, {}];
        var obj, values = _.pluck(json.resultset, colIndex);
        return obj = "Numeric" === json.metadata[colIndex].colType ? {
          type: "numeric",
          min: _.min(values),
          max: _.max(values)
        } : {
          type: "categoric",
          items: _.uniq(values)
        }, [role, obj];
      }).object().value();
      return extremes;
    },
    _addSeriesToModel: function (seriesRoot, json) {
      var mapping = $.extend({}, this.mapping), colNames = _.pluck(json.metadata, "colName"), me = this, modes = MapModel.Modes, states = MapModel.States, actions = MapModel.Actions, series = _.map(json.resultset, function (row, rowIdx) {
        var id = me._getItemId(mapping, row, rowIdx), styleMap = {};
        _.each(modes, function (mode) {
          _.each(states, function (state) {
            _.each(actions, function (action) {
              _.each(me.attributeMapping, function (functionOrValue, attribute) {
                if (!(_.isUndefined(mapping[attribute]) || mapping[attribute] >= row.length)) {
                  var context = {
                    mode: mode,
                    state: state,
                    action: action
                  }, value = _.isFunction(functionOrValue) ? functionOrValue.call(me, context, seriesRoot, mapping, row, rowIdx) : functionOrValue;
                  _.isUndefined(value) || (styleMap[mode] = styleMap[mode] || {}, styleMap[mode][state] = styleMap[mode][state] || {},
                    styleMap[mode][state][action] = styleMap[mode][state][action] || {}, styleMap[mode][state][action][attribute] = value);
                }
              });
            });
          });
        });
        var shapeDefinition = me.features.shapes ? me.features.shapes[id] : void 0, markerDefinition = me.features.markers ? me.features.markers[id] : void 0, geoJSON = "shape" === seriesRoot.getFeatureType() ? shapeDefinition : markerDefinition;
        return {
          id: id,
          label: id,
          styleMap: styleMap,
          geoJSON: geoJSON,
          rowIdx: rowIdx,
          rawData: row,
          data: _.object(_.zip(colNames, row))
        };
      });
      seriesRoot.add(series);
    },
    _getItemId: function (mapping, row, rowIdx) {
      var indexId = mapping.id;
      return _.isFinite(indexId) || (indexId = "shapes" === this.mapMode ? 0 : -1), indexId >= 0 && indexId < row.length ? row[indexId] : rowIdx;
    }
  };
}), define("cde/components/Map/Map.configuration", ["cdf/lib/jquery", "amd!cdf/lib/underscore"], function ($, _) {
  function getConfiguration() {
    var addIns = {
      MarkerImage: {
        name: this.markerCggGraph ? "cggMarker" : this.markerImageGetter,
        options: {
          cggScript: this.markerCggGraph,
          parameters: this.cggGraphParameters,
          height: this.markerHeight,
          width: this.markerWidth,
          iconUrl: this.marker
        }
      },
      ShapeResolver: {
        name: this.shapeResolver,
        options: {
          url: this.shapeSource,
          parseShapeKey: this.parseShapeKey
        }
      },
      LocationResolver: {
        name: this.locationResolver || "openstreetmap",
        options: {}
      },
      MapEngine: {
        name: this.mapEngineType,
        options: {
          rawOptions: {
            map: {}
          },
          tileServices: this.tileServices,
          tileServicesOptions: this.tileServicesOptions,
          tilesets: _.isString(this.tilesets) ? [this.tilesets] : this.tilesets,
          API_KEY: this.API_KEY || window.API_KEY
        }
      }
    }, viewport = {
      center: {
        latitude: parseFloat(this.centerLatitude),
        longitude: parseFloat(this.centerLongitude)
      },
      zoomLevel: {
        min: 0,
        max: 1 / 0,
        "default": this.defaultZoomLevel
      }
    };
    return $.extend(!0, {}, {
      isSelector: !_.isEmpty(this.parameter),
      addIns: addIns,
      styleMap: this.styleMap,
      viewport: viewport
    }, _.result(this, "options"));
  }

  return {
    getConfiguration: getConfiguration
  };
}), define("cde/components/Map/Map.featureStyles", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "cdf/Logger"], function ($, _, Logger) {
  function getStyleMap(styleName) {
    var localStyleMap = _.result(this, "styleMap") || {}, styleMap = $.extend(!0, {}, styleMaps.global, this.configuration.isSelector ? {} : styleMaps.global_override_when_no_parameter_is_defined, styleMaps[styleName], localStyleMap.global, localStyleMap[styleName]);
    switch (styleName) {
      case "shapes":
        Logger.warn("Usage of the 'shapeSettings' property (including shapeSettings.fillOpacity, shapeSettings.strokeWidth and shapeSettings.strokeColor) is deprecated."),
          Logger.warn("Support for these properties will be removed in the next major version.");
    }
    return styleMap;
  }

  var styleMaps = {
    global: {
      "stroke-width": 1,
      stroke: "white",
      hover: {
        stroke: "black",
        cursor: "pointer"
      },
      unselected: {
        "fill-opacity": .2
      },
      selected: {
        "fill-opacity": .8
      }
    },
    global_override_when_no_parameter_is_defined: {
      unselected: {
        "fill-opacity": .8
      },
      hover: {
        cursor: "default"
      }
    },
    markers: {
      r: 10,
      symbol: "circle",
      labelAlign: "cm",
      labelYOffset: -20,
      fill: "red",
      "stroke-width": 2
    },
    shapes: {
      "stroke-width": 1.5,
      normal: {
        "z-index": 0
      },
      hover: {
        "z-index": 1
      }
    }
  };
  return {
    getStyleMap: getStyleMap
  };
}), define("cde/components/Map/Map.colorMap", ["amd!cdf/lib/underscore"], function (_) {
  function color2array(color) {
    var rgba = _.clone(color);
    return _.isArray(color) ? (rgba = color, 3 === rgba.length && rgba.push(1)) : _.isString(color) && ("#" === color[0] ? rgba = [parseInt(color.substring(1, 3), 16), parseInt(color.substring(3, 5), 16), parseInt(color.substring(5, 7), 16), 1] : "rgba" === color.substring(0, 4) && (rgba = color.slice(5, -1).split(",").map(parseFloat))),
      rgba;
  }

  function interpolate(a, b, n) {
    var k, kk, step, colormap = [], d = [];
    for (k = 0; k < a.length; k++) for (colormap[k] = [], kk = 0, step = (b[k] - a[k]) / n; n > kk; kk++) colormap[k][kk] = a[k] + kk * step;
    for (k = 0; k < colormap[0].length && 3 > k; k++) for (d[k] = [], kk = 0; kk < colormap.length; kk++) d[k][kk] = Math.round(colormap[kk][k]);
    return d;
  }

  return {
    colormaps: {
      "default": ["#79be77", "#96b761", "#b6ae4c", "#e0a433", "#f4a029", "#fa8e1f", "#f47719", "#ec5f13", "#e4450f", "#dc300a"],
      default0: [[0, 102, 0, 1], [255, 255, 0, 1], [255, 0, 0, 1]],
      jet: [],
      gray: [[0, 0, 0, 255], [255, 255, 255, 1]],
      "french-flag": [[255, 0, 0, 1], [255, 254, 255, 1], [0, 0, 255, 1]]
    },
    getColorMap: function () {
      var colorMap = [];
      colorMap = null == this.colormap || _.isArray(this.colormap) && !this.colormap.length ? _.clone(this.colormaps["default"]) : _.map(this.colormap, JSON.parse),
        colorMap = _.map(colorMap, color2array);
      var cmap = [];
      for (k = 1, L = colorMap.length; k < L; k++) cmap = cmap.concat(interpolate(colorMap[k - 1], colorMap[k], 32));
      return _.map(cmap, function (v) {
        return "rgba(" + v.join(",") + ")";
      });
    },
    mapColor: function (value, minValue, maxValue, colormap) {
      var n = colormap.length, level = (value - minValue) / (maxValue - minValue);
      return colormap[Math.floor(level * (n - 1))];
    },
    toGrayscale: function (color) {
      var rgba = color2array(color), g = Math.round(Math.sqrt(.2989 * rgba[0] * rgba[0] + .587 * rgba[1] * rgba[1] + .114 * rgba[2] * rgba[2])), v = [g, g, g, rgba[3]];
      return "rgba(" + v.join(",") + ")";
    }
  };
}), define("text!cde/components/Map/ControlPanel/ControlPanel.html", [], function () {
  return '<div class="map-control-panel">\n    <div class="map-control-button map-control-zoom-in"></div>\n    <div class="map-control-button map-control-zoom-out"></div>\n    <div class="map-controls-mode {{mode}}">\n        <div class="map-control-button map-control-pan"></div>\n        <div class="map-control-button map-control-zoombox"></div>\n        {{#configuration.isSelector}}\n        <div class="map-control-button map-control-select"></div>\n        {{/configuration.isSelector}}\n    </div>\n</div>';
}), define("cde/components/Map/ControlPanel/ControlPanel", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "cdf/lib/mustache", "cdf/lib/BaseEvents", "../model/MapModel", "text!./ControlPanel.html", "css!./ControlPanel"], function ($, _, Mustache, BaseEvents, MapModel, template) {
  return BaseEvents.extend({
    constructor: function (domNode, model, configuration) {
      return this.base(), this.ph = $(domNode), this.model = model, this.configuration = configuration,
        this;
    },
    render: function () {
      var viewModel = {
        mode: this.model.getMode(),
        configuration: this.configuration
      }, html = Mustache.render(template, viewModel);
      return this.ph.empty().append(html), this._bindEvents(), this;
    },
    zoomOut: function () {
      return this.trigger("zoom:out"), this;
    },
    zoomIn: function () {
      return this.trigger("zoom:in"), this;
    },
    setPanningMode: function () {
      return this.model.setPanningMode(), this;
    },
    setZoomBoxMode: function () {
      return this.model.setZoomBoxMode(), this;
    },
    setSelectionMode: function () {
      return this.model.setSelectionMode(), this;
    },
    _bindEvents: function () {
      var bindings = {
        ".map-control-zoom-out": this.zoomOut,
        ".map-control-zoom-in": this.zoomIn,
        ".map-control-pan": this.setPanningMode,
        ".map-control-zoombox": this.setZoomBoxMode,
        ".map-control-select": this.setSelectionMode
      }, me = this;
      _.each(bindings, function (callback, selector) {
        me.ph.find(selector).click(_.bind(callback, me));
      }), this.listenTo(this.model, "change:mode", _.bind(this._updateView, this));
    },
    _updateView: function () {
      var mode = this.model.getMode();
      this.ph.find(".map-controls-mode").removeClass(_.values(MapModel.Modes).join(" ")).addClass(mode);
    }
  });
}), define("cde/components/Map/Map.tileServices", [], function () {
  var _tileServices = {
    "default": "http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}.png",
    apple: "http://gsp2.apple.com/tile?api=1&style=slideshow&layers=default&lang=en_US&z=${z}&x=${x}&y=${y}&v=9",
    google: "http://mt{switch:0,1,2,3}.googleapis.com/vt?x=${x}&y=${y}&z=${z}",
    mapquest: "http://otile{switch:1,2,3,4}.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png",
    "mapquest-normal": "http://otile{switch:1,2,3,4}.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.png",
    "mapquest-hybrid": "http://otile{switch:1,2,3,4}.mqcdn.com/tiles/1.0.0/hyb/${z}/${x}/${y}.png",
    "mapquest-sat": "http://otile{switch:1,2,3,4}.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg",
    "mapbox-world-light": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/mapbox.world-light/${z}/${x}/${y}.jpg",
    "mapbox-world-dark": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/mapbox.world-dark/${z}/${x}/${y}.jpg",
    "mapbox-terrain": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/examples.map-9ijuk24y/${z}/${x}/${y}.jpg",
    "mapbox-satellite": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/examples.map-qfyrx5r8/${z}/${x}/${y}.png",
    "mapbox-example": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/examples.c7d2024a/${z}/${x}/${y}.png",
    "mapbox-example2": "https://{switch:a,b,c,d}.tiles.mapbox.com/v3/examples.bc17bb2a/${z}/${x}/${y}.png",
    openstreetmaps: "http://{switch:a,b,c}.tile.openstreetmap.org/${z}/${x}/${y}.png",
    openmapsurfer: "http://129.206.74.245:8001/tms_r.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-roads": "http://129.206.74.245:8001/tms_r.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-semitransparent": "http://129.206.74.245:8003/tms_h.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-hillshade": "http://129.206.74.245:8004/tms_hs.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-contour": "http://129.206.74.245:8006/tms_b.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-administrative": "http://129.206.74.245:8007/tms_b.ashx?x=${x}&y=${y}&z=${z}",
    "openmapsurfer-roads-grayscale": "http://129.206.74.245:8008/tms_rg.ashx?x=${x}&y=${y}&z=${z}",
    stamen: "http://{switch:a,b,c,d}.tile.stamen.com/terrain/${z}/${x}/${y}.jpg",
    "stamen-terrain": "http://{switch:a,b,c,d}.tile.stamen.com/terrain/${z}/${x}/${y}.jpg",
    "stamen-terrain-background": "http://{switch:a,b,c,d}.tile.stamen.com/terrain-background/${z}/${x}/${y}.jpg",
    "stamen-terrain-labels": "http://{switch:a,b,c,d}.tile.stamen.com/terrain-labels/${z}/${x}/${y}.jpg",
    "stamen-toner": "http://{switch:a,b,c,d}.tile.stamen.com/toner/${z}/${x}/${y}.png",
    "stamen-toner-lite": "http://{switch:a,b,c,d}.tile.stamen.com/toner-lite/${z}/${x}/${y}.png",
    "stamen-toner-background": "http://{switch:a,b,c,d}.tile.stamen.com/toner-background/${z}/${x}/${y}.png",
    "stamen-toner-hybrid": "http://{switch:a,b,c,d}.tile.stamen.com/toner-hybrid/${z}/${x}/${y}.png",
    "stamen-toner-labels": "http://{switch:a,b,c,d}.tile.stamen.com/toner-labels/${z}/${x}/${y}.png",
    "stamen-toner-lines": "http://{switch:a,b,c,d}.tile.stamen.com/toner-lines/${z}/${x}/${y}.png",
    "stamen-toner-2010": "http://{switch:a,b,c,d}.tile.stamen.com/toner-2010/${z}/${x}/${y}.png",
    "stamen-toner-2011": "http://{switch:a,b,c,d}.tile.stamen.com/toner-2011/${z}/${x}/${y}.png",
    "stamen-watercolor": "http://{switch:a,b,c,d}.tile.stamen.com/watercolor/${z}/${x}/${y}.jpg",
    "nokia-normal": "http://maptile.maps.svc.ovi.com/maptiler/maptile/newest/normal.day/${z}/${x}/${y}/256/png8",
    "nokia-normal-grey": "http://maptile.maps.svc.ovi.com/maptiler/maptile/newest/normal.day.grey/${z}/${x}/${y}/256/png8",
    "nokia-normal-transit": "http://maptile.maps.svc.ovi.com/maptiler/maptile/newest/normal.day.transit/${z}/${x}/${y}/256/png8",
    "nokia-satellite": "http://maptile.maps.svc.ovi.com/maptiler/maptile/newest/satellite.day/${z}/${x}/${y}/256/png8",
    "nokia-terrain": "http://maptile.maps.svc.ovi.com/maptiler/maptile/newest/terrain.day/${z}/${x}/${y}/256/png8",
    "arcgis-street": "http://services.arcgisonline.com/ArcGIS/rest/services/World_street_Map/MapServer/tile/${z}/${y}/${x}",
    "arcgis-topographic": "http://services.arcgisonline.com/ArcGIS/rest/services/World_street_Topo/MapServer/tile/${z}/${y}/${x}",
    "arcgis-natgeo": "http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/${z}/${y}/${x}",
    "arcgis-world": "http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}",
    "arcgis-lightgray": "http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}.png",
    "arcgis-delorme": "http://services.arcgisonline.com/ArcGIS/rest/services/Specialty/DeLorme_World_Base_Map/MapServer/tile/${z}/${y}/${x}"
  };
  return {
    tileServices: _tileServices,
    otherTileServices: [],
    tileServicesOptions: {
      apple: {
        minZoom: 3,
        maxZoom: 14
      }
    }
  };
}), define("cde/components/Map/engines/MapEngine", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "cdf/lib/BaseEvents", "../model/MapModel"], function ($, _, BaseEvents, MapModel) {
  return BaseEvents.extend({
    tileServices: void 0,
    tileServicesOptions: void 0,
    tileLayer: function (name) {
    },
    init: function () {
      var deferred = $.Deferred();
      return deferred.resolve(), deferred.promise();
    },
    renderMap: function (target) {
    },
    render: function (model) {
      this.model = model;
      var me = this;
      this.listenTo(this.model.root(), "change:mode", function (model, value) {
        var modes = {
          selection: me.setSelectionMode,
          zoombox: me.setZoomBoxMode,
          pan: me.setPanningMode
        };
        modes[value] && modes[value].call(me), model.leafs().each(function (m) {
          me.updateItem(m);
        });
      }), this.listenTo(this.model, "change:isSelected change:isHighlighted change:isVisible", function (model, value) {
        model.children() || me.updateItem(model);
      }), model.leafs().each(function (m) {
        me.renderItem(m);
      }), model.isPanningMode() && me.setPanningMode(), model.isZoomBoxMode() && me.setZoomBoxMode(),
      model.isSelectionMode() && me.setSelectionMode();
    },
    updateViewport: function (centerLongitude, centerLatitude, zoomLevel) {
    },
    showPopup: function () {
    },
    _wrapEvent: function (modelItem) {
      return {
        model: modelItem,
        data: $.extend(!0, {}, modelItem.get("data"), modelItem.get("rawData")),
        id: modelItem.get("id"),
        featureType: modelItem.getFeatureType(),
        style: modelItem.getStyle(),
        isSelected: function () {
          return modelItem.getSelection() === MapModel.SelectionStates.ALL;
        }
      };
    },
    toNativeStyle: function (foreignStyle) {
      var validStyle = {};
      return _.each(foreignStyle, function (value, key) {
        switch (key) {
          case "visible":
          case "zIndex":
          case "fillColor":
          case "fillOpacity":
          case "strokeColor":
          case "strokeOpacity":
          case "strokeWidth":
        }
      }), validStyle;
    },
    wrapEvent: function (event, featureType) {
      return {
        latitude: void 0,
        longitude: void 0,
        data: void 0,
        feature: void 0,
        featureType: featureType,
        style: void 0,
        mapEngineType: "abstract",
        draw: function (style) {
        },
        raw: void 0
      };
    },
    _selectUrl: function (paramString, urls) {
      for (var product = 1, URL_HASH_FACTOR = (Math.sqrt(5) - 1) / 2, i = 0, len = paramString.length; len > i; i++) product *= paramString.charCodeAt(i) * URL_HASH_FACTOR,
        product -= Math.floor(product);
      return urls[Math.floor(product * urls.length)];
    },
    _switchUrl: function (url) {
      var list = url.match(/(http[s]?:\/\/[0-9a-z.]*?)\{switch:([a-z0-9,]+)\}(.*)/);
      if (!list || 0 == list.length) return url;
      for (var servers = list[2].split(","), url_list = [], i = 0; i < servers.length; i++) url_list.push(list[1] + servers[i] + list[3]);
      return url_list;
    },
    _getTileServiceURL: function (name) {
      var urlTemplate = this.tileServices[name];
      return urlTemplate || name.length > 0 && name.indexOf("{") > -1 && (urlTemplate = name),
        urlTemplate;
    }
  });
}), define("cde/components/Map/engines/openlayers2/MapEngineOpenLayers", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "../MapEngine", "cdf/lib/OpenLayers", "../../model/MapModel", "cdf/Logger", "css!./styleOpenLayers2"], function ($, _, MapEngine, OpenLayers, MapModel, Logger) {
  function clearSelection(me) {
    var SelectionStates = MapModel.SelectionStates;
    return function (feature) {
      me.model && (me.model.flatten().each(function (m) {
        m.setSelection(SelectionStates.NONE);
      }), me.trigger("engine:selection:complete"));
    };
  }

  function addToSelection(modelItem) {
    modelItem.setSelection(MapModel.SelectionStates.ALL);
  }

  function toggleSelection(me) {
    var SelectionStates = MapModel.SelectionStates, toggleTable = {};
    return toggleTable[SelectionStates.ALL] = SelectionStates.NONE, toggleTable[SelectionStates.SOME] = SelectionStates.NONE,
      toggleTable[SelectionStates.NONE] = SelectionStates.ALL, function (feature) {
      this.clickFeature(feature);
      var model = feature.attributes.model, newState = toggleTable[model.getSelection()];
      model.setSelection(newState);
      var eventName = model.getFeatureType() + ":click";
      me.trigger("engine:selection:complete"), me.trigger(eventName, me.wrapEvent({
        feature: feature
      }));
    };
  }

  return MapEngine.extend({
    map: void 0,
    API_KEY: 0,
    constructor: function (options) {
      this.base(), $.extend(this, options), this.layers = {}, this.controls = {};
    },
    toNativeStyle: function (foreignStyle) {
      var conversionTable = {
        fill: "fillColor",
        "fill-opacity": "fillOpacity",
        stroke: "strokeColor",
        "stroke-opacity": "strokeOpacity",
        "stroke-width": "strokeWidth",
        r: "pointRadius",
        "z-index": "graphicZIndex",
        "icon-url": "externalGraphic",
        iconUrl: "externalGraphic",
        width: "graphicWidth",
        height: "graphicHeight",
        symbol: "graphicName",
        fillColor: "fillColor",
        fillOpacity: "fillOpacity",
        strokeColor: "strokeColor",
        strokeOpacity: "strokeOpacity",
        strokeWidth: "strokeWidth",
        zIndex: "graphicZIndex"
      }, validStyle = {};
      return _.each(foreignStyle, function (value, key) {
        var nativeKey = conversionTable[key];
        if (nativeKey) validStyle[nativeKey] = value; else switch (key) {
          case "visible":
            validStyle.display = value ? !0 : "none";
            break;

          default:
            validStyle[key] = value;
        }
      }), validStyle;
    },
    wrapEvent: function (event) {
      var coords, feature = event.feature, modelItem = event.feature.attributes.model, lastXy = this.controls.mousePosition.lastXy;
      coords = lastXy ? this.map.getLonLatFromPixel(lastXy).transform(this.map.getProjectionObject(), new OpenLayers.Projection("EPSG:4326")) : {
        lat: void 0,
        lon: void 0
      };
      var me = this;
      return $.extend(this._wrapEvent(modelItem), {
        mapEngineType: "openlayers2",
        latitude: coords.lat,
        longitude: coords.lon,
        feature: feature,
        _popup: function (html, options) {
          var opt = $.extend({
            width: 100,
            height: 100
          }, options || {});
          me.showPopup(null, feature, opt.height, opt.width, html, null, null);
        },
        draw: function (style) {
          var validStyle = me.toNativeStyle(style);
          event.feature.layer.drawFeature(feature, validStyle);
        },
        _setSelectedStyle: function (style) {
          event.feature.attributes.clickSelStyle = style;
        },
        _getSelectedStyle: function () {
          return event.feature.attributes.clickSelStyle;
        },
        raw: event
      });
    },
    renderItem: function (modelItem) {
      if (modelItem) {
        var layer = this.layers[modelItem.root().children().first().get("id")], geoJSON = modelItem.get("geoJSON"), me = this;
        $.when(geoJSON).then(function (feature) {
          if (feature) {
            var f = me._geoJSONParser.parseFeature(feature), style = modelItem.getStyle();
            $.extend(!0, f, {
              attributes: {
                id: modelItem.get("id"),
                model: modelItem
              },
              style: me.toNativeStyle(style)
            }), layer.addFeatures([f]);
          }
        });
      }
    },
    showPopup: function (data, feature, popupHeight, popupWidth, contents, popupContentDiv, borderColor) {
      if (popupContentDiv && popupContentDiv.length > 0) {
        var div = $("<div/>");
        div.append($("#" + popupContentDiv)), contents = div.html();
      }
      var name = "featurePopup";
      void 0 != borderColor && (name += borderColor.substring(1));
      var p = feature.geometry.getCentroid();
      feature.lonlat = new OpenLayers.LonLat(p.x, p.y);
      var popup = new OpenLayers.Popup.Anchored(name, feature.lonlat, new OpenLayers.Size(popupWidth, popupHeight), contents, null, !0, null);
      feature.popup = popup, popup.feature = feature, _.each(this.map.popups, function (elt) {
        elt.hide();
      }), this.map.addPopup(popup, !0);
    },
    renderMap: function (target) {
      var projectionMap = new OpenLayers.Projection("EPSG:900913"), projectionWGS84 = new OpenLayers.Projection("EPSG:4326"), mapOptions = {
        zoom: this.options.viewport.zoomLevel["default"],
        zoomDuration: 10,
        displayProjection: projectionWGS84,
        projection: projectionMap,
        controls: [new OpenLayers.Control.Navigation(), new OpenLayers.Control.DragPan(), new OpenLayers.Control.PinchZoom(), new OpenLayers.Control.LayerSwitcher({
          ascending: !1
        }), new OpenLayers.Control.ScaleLine(), new OpenLayers.Control.KeyboardDefaults(), new OpenLayers.Control.Attribution(), new OpenLayers.Control.TouchNavigation()]
      };
      OpenLayers.TileManager && (mapOptions.tileManager = new OpenLayers.TileManager()),
        this.map = new OpenLayers.Map(target, mapOptions);
      var me = this;
      this.map.isValidZoomLevel = function (z) {
        var minZoom = _.isFinite(me.options.viewport.zoomLevel.min) ? me.options.viewport.zoomLevel.min : 0, maxZoom = _.isFinite(me.options.viewport.zoomLevel.max) ? me.options.viewport.zoomLevel.max : this.getNumZoomLevels();
        return null != z && z >= minZoom && maxZoom >= z;
      }, this.addLayers(), this.addControls(), this.registerViewportEvents(), this._geoJSONParser = new OpenLayers.Format.GeoJSON({
        ignoreExtraDims: !0,
        internalProjection: this.map.getProjectionObject(),
        externalProjection: projectionWGS84
      });
    },
    addLayers: function () {
      var me = this;
      _.each(this.tilesets, function (thisTileset) {
        var layer, tileset = thisTileset.slice(0).split("-")[0], variant = thisTileset.slice(0).split("-").slice(1).join("-") || "default";
        switch (tileset) {
          case "googleXXX":
            layer = new OpenLayers.Layer.Google("Google Streets", {
              visibility: !0,
              version: "3"
            });
            break;

          case "opengeo":
            layer = new OpenLayers.Layer.WMS(thisTileset, "http://maps.opengeo.org/geowebcache/service/wms", {
              layers: variant,
              bgcolor: "#A1BDC4"
            }, {
              wrapDateLine: !0,
              transitionEffect: "resize"
            });
            break;

          default:
            layer = me.tileLayer(thisTileset);
        }
        me.map.addLayer(layer), me.layers[thisTileset] = layer;
      }), this.layers.shapes = new OpenLayers.Layer.Vector("Shapes", {
        rendererOptions: {
          zIndexing: !0
        }
      }), this.layers.markers = new OpenLayers.Layer.Vector("Markers"), this.map.addLayers([this.layers.shapes, this.layers.markers]);
    },
    setPanningMode: function () {
      this.controls.clickCtrl.activate(), this.controls.zoomBox.deactivate(), this.controls.boxSelector.deactivate();
    },
    setZoomBoxMode: function () {
      this.controls.clickCtrl.activate(), this.controls.zoomBox.activate(), this.controls.boxSelector.deactivate();
    },
    setSelectionMode: function () {
      this.controls.clickCtrl.deactivate(), this.controls.boxSelector.activate(), this.controls.zoomBox.deactivate();
    },
    zoomIn: function () {
      this.map.zoomIn();
    },
    zoomOut: function () {
      this.map.zoomOut();
    },
    updateViewport: function (centerLongitude, centerLatitude, zoomLevel) {
      if (_.isFinite(zoomLevel)) this.map.zoomTo(zoomLevel); else {
        var bounds = new OpenLayers.Bounds(), markersBounds = this.layers.markers.getDataExtent(), shapesBounds = this.layers.shapes.getDataExtent();
        markersBounds || shapesBounds ? (bounds.extend(markersBounds), bounds.extend(shapesBounds)) : bounds = null,
          bounds ? this.map.zoomToExtent(bounds) : this.map.zoomTo(this.options.viewport.zoomLevel["default"]);
      }
      var centerPoint, projectionWGS84 = new OpenLayers.Projection("EPSG:4326");
      _.isFinite(centerLatitude) && _.isFinite(centerLongitude) ? (centerPoint = new OpenLayers.LonLat(centerLongitude, centerLatitude).transform(projectionWGS84, this.map.getProjectionObject()),
        this.map.setCenter(centerPoint)) : bounds || (centerPoint = new OpenLayers.LonLat(-10, 20).transform(projectionWGS84, this.map.getProjectionObject()),
        this.map.setCenter(centerPoint));
    },
    addControls: function () {
      this._addControlMousePosition(), this._addControlHover(), this._addControlClick(),
        this._addControlBoxSelector(), this._addControlZoomBox();
    },
    _addControlMousePosition: function () {
      this.controls.mousePosition = new OpenLayers.Control.MousePosition(), this.map.addControl(this.controls.mousePosition);
    },
    _addControlClick: function () {
      this.controls.clickCtrl = new OpenLayers.Control.SelectFeature([this.layers.markers, this.layers.shapes], {
        clickout: !0,
        callbacks: {
          clickout: clearSelection(this),
          click: toggleSelection(this)
        }
      }), this.controls.clickCtrl.handlers.feature.stopDown = !1, this.map.addControl(this.controls.clickCtrl);
    },
    _addControlBoxSelector: function () {
      var me = this;
      this.controls.boxSelector = new OpenLayers.Control.SelectFeature([this.layers.shapes, this.layers.markers], {
        clickout: !0,
        toggle: !0,
        multiple: !0,
        hover: !1,
        box: !0,
        callbacks: {
          clickout: clearSelection(this),
          click: toggleSelection(this)
        }
      }), this.map.addControl(this.controls.boxSelector), this.controls.boxSelector.events.on({
        activate: function (e) {
          e.object.unselectAll();
        },
        boxselectionend: function (e) {
          _.each(e.layers, function (layer) {
            _.each(layer.selectedFeatures, function (f) {
              addToSelection(f.attributes.model);
            });
          }), e.object.unselectAll(), me.trigger("engine:selection:complete");
        }
      });
    },
    _addControlZoomBox: function () {
      this.controls.zoomBox = new OpenLayers.Control.ZoomBox({
        zoomOnClick: !1
      }), this.map.addControl(this.controls.zoomBox);
    },
    _addControlHover: function () {
      function event_relay(e) {
        var events = {
          featurehighlighted: "mouseover",
          featureunhighlighted: "mouseout"
        };
        if (events[e.type]) {
          var model = e.feature.attributes.model;
          model.setHover("mouseover" === events[e.type]), me.trigger(model.getFeatureType() + ":" + events[e.type], me.wrapEvent(e));
        }
      }

      var me = this;
      this.controls.hoverCtrl = new OpenLayers.Control.SelectFeature([this.layers.markers, this.layers.shapes], {
        hover: !0,
        highlightOnly: !0,
        renderIntent: "temporary",
        eventListeners: {
          featurehighlighted: event_relay,
          featureunhighlighted: event_relay
        },
        outFeature: function (feature) {
          if (this.hover) if (this.highlightOnly) if (feature._lastHighlighter == this.id) if (feature._prevHighlighter && feature._prevHighlighter != this.id) {
            delete feature._lastHighlighter;
            var control = this.map.getControl(feature._prevHighlighter);
            control && (control.highlight(feature), this.events.triggerEvent("featureunhighlighted", {
              feature: feature
            }));
          } else this.unhighlight(feature); else this.events.triggerEvent("featureunhighlighted", {
            feature: feature
          }); else this.unselect(feature);
        }
      }), this.controls.hoverCtrl.handlers.feature.stopDown = !1, this.map.addControl(this.controls.hoverCtrl),
        this.controls.hoverCtrl.activate();
    },
    updateItem: function (modelItem) {
      var style = this.toNativeStyle(modelItem.getStyle()), featureType = modelItem.getFeatureType(), layerName = "marker" === featureType ? "markers" : "shapes", layer = this.layers[layerName], feature = layer.getFeaturesByAttribute("id", modelItem.get("id"))[0];
      feature && (feature.style = style, feature.layer.drawFeature(feature, style));
    },
    tileLayer: function (name) {
      var urlTemplate = this._getTileServiceURL(name), options = _.extend({
        transitionEffect: "resize"
      }, this.tileServicesOptions[name] || {});
      return new OpenLayers.Layer.XYZ(name, this._switchUrl(urlTemplate), _.extend({}, options));
    },
    registerViewportEvents: function () {
      function wrapViewportEvent(e) {
        var mapProj = this.map.getProjectionObject(), wsg84 = new OpenLayers.Projection("EPSG:4326"), transformPoint = function (centerPoint) {
          var center;
          if (centerPoint) {
            var p = centerPoint.clone().transform(mapProj, wsg84);
            center = {
              latitude: p.lat,
              longitude: p.lon
            };
          } else center = {
            latitude: void 0,
            longitude: void 0
          };
          return center;
        }, extentObj = e.object.getExtent(), viewport = {
          northEast: {},
          southWest: {}
        };
        if (extentObj) {
          var extentInLatLon = extentObj.transform(mapProj, wsg84);
          viewport = {
            northEast: {
              latitude: extentInLatLon.top,
              longitude: extentInLatLon.right
            },
            southWest: {
              latitude: extentInLatLon.bottom,
              longitude: extentInLatLon.left
            }
          };
        }
        var wrappedEvent = {
          zoomLevel: e.object.getZoom(),
          center: transformPoint(e.object.center),
          viewport: viewport,
          raw: e
        };
        return wrappedEvent;
      }

      var me = this, eventMap = {
        zoomend: "map:zoom",
        movestart: "map:center"
      };
      _.each(eventMap, function (mapEvent, engineEvent) {
        me.map.events.register(engineEvent, me.map, function (e) {
          var wrappedEvent = wrapViewportEvent.call(me, e);
          me.trigger(mapEvent, wrappedEvent);
        });
      });
    }
  });
}), define("cde/components/Map/engines/google/MapComponentAsyncLoader", ["cdf/lib/jquery"], function ($) {
  return function ($) {
    var promise, now = $.now();
    return function (version, apiKey) {
      if (promise) return promise;
      var params, deferred = $.Deferred(), resolve = function () {
        deferred.resolve(window.google && google.maps ? google.maps : !1);
      }, callbackName = "loadGoogleMaps_" + now++;
      return window.google && google.maps ? resolve() : window.google && google.load ? google.load("maps", version || 3, {
        callback: resolve
      }) : (params = $.extend({
        v: version || 3,
        callback: callbackName
      }, apiKey ? {
        key: apiKey
      } : {}), window[callbackName] = function () {
        resolve(), setTimeout(function () {
          try {
            delete window[callbackName];
          } catch (e) {
          }
        }, 20);
      }, $.ajax({
        dataType: "script",
        data: params,
        url: "http://maps.googleapis.com/maps/api/js"
      })), promise = deferred.promise();
    };
  }($);
}), define("cde/components/Map/engines/google/MapEngineGoogle", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "../MapEngine", "./MapComponentAsyncLoader", "../../model/MapModel", "css!./styleGoogle"], function ($, _, MapEngine, MapComponentAsyncLoader, MapModel) {
  function OurMapOverlay(startPoint, width, height, htmlContent, popupContentDiv, map, borderColor) {
    this.startPoint_ = startPoint, this.width_ = width, this.height_ = height, this.map_ = map,
      this.htmlContent_ = htmlContent, this.popupContentDiv_ = popupContentDiv, this.borderColor_ = borderColor,
      this.div_ = null, this.setMap(map);
  }

  function clearSelection(modelItem) {
    modelItem.root().setSelection(MapModel.SelectionStates.NONE);
  }

  function addToSelection(modelItem) {
    modelItem.setSelection(MapModel.SelectionStates.ALL);
  }

  function toggleSelection(modelItem) {
    modelItem.setSelection(modelItem.getSelection() === MapModel.SelectionStates.ALL ? MapModel.SelectionStates.NONE : MapModel.SelectionStates.ALL);
  }

  function isInBounds(geometry, bounds) {
    function containsMultiPolygon(bounds, multiPolygon) {
      var hasPolygon = function (polygon) {
        return containsPolygon(bounds, polygon);
      };
      return _.some(multiPolygon, hasPolygon);
    }

    function containsPolygon(bounds, polygon) {
      var hasPoint = function (point) {
        return containsPoint(bounds, point);
      };
      return _.some(polygon, function (line) {
        return _.some(line, hasPoint);
      });
    }

    function containsPoint(bounds, point) {
      var latLng = new google.maps.LatLng(point[1], point[0]);
      return bounds.contains(latLng);
    }

    switch (geometry.type) {
      case "MultiPolygon":
        return containsMultiPolygon(bounds, geometry.coordinates);

      case "Polygon":
        return containsPolygon(bounds, geometry.coordinates);

      case "Point":
        return containsPoint(bounds, geometry.coordinates);

      default:
        return !1;
    }
  }

  return MapEngine.extend({
    map: void 0,
    centered: !1,
    boxStyle: {
      fillOpacity: .15,
      strokeWeight: .9
    },
    overlays: [],
    API_KEY: !1,
    selectedFeature: void 0,
    constructor: function (options) {
      this.base(), $.extend(this, options), this.controls = {}, this.controls.listenersHandle = {};
    },
    init: function () {
      return $.when(MapComponentAsyncLoader("3", this.API_KEY)).then(function (status) {
        OurMapOverlay.prototype = new google.maps.OverlayView(), OurMapOverlay.prototype.onAdd = function () {
          var div = document.createElement("DIV");
          div.id = "MapOverlay", div.style.position = "absolute", this.borderColor_ ? div.style.border = "3px solid " + this.borderColor_ : div.style.border = "none";
          var me = this, closeDiv = $('<div id="MapOverlay_close" class="olPopupCloseBox" style="position: absolute;"></div>');
          closeDiv.click(function () {
            me.setMap(null);
          }), $(div).append(closeDiv), this.popupContentDiv_ && this.popupContentDiv_.length > 0 ? $(div).append($("#" + this.popupContentDiv_)) : div.innerHTML = this.htmlContent_,
            this.div_ = div;
          var panes = this.getPanes();
          panes.overlayLayer.appendChild(div);
        }, OurMapOverlay.prototype.draw = function () {
          var overlayProjection = this.getProjection(), sp = overlayProjection.fromLatLngToDivPixel(this.startPoint_), div = this.div_;
          div.style.left = sp.x + "px", div.style.top = sp.y + 30 + "px", div.style.width = this.width_ + "px",
            div.style.height = this.height_ + "px";
        }, OurMapOverlay.prototype.onRemove = function () {
          this.popupContentDiv_ && ($("#" + this.popupContentDiv_).append($(this.div_)), $(this.div_).detach()),
            this.div_.style.display = "none", this.div_.parentNode.removeChild(this.div_), this.div_ = null;
        };
      });
    },
    wrapEvent: function (event, featureType) {
      var me = this, modelItem = event.feature.getProperty("model");
      return $.extend(this._wrapEvent(modelItem), {
        latitude: event.latLng.lat(),
        longitude: event.latLng.lng(),
        _popup: function (html, options) {
          var opt = $.extend({
            width: 100,
            height: 100
          }, options || {});
          me.showPopup(null, feature, opt.height, opt.width, html, null, null);
        },
        feature: event.feature,
        mapEngineType: "google3",
        draw: function (style) {
          var validStyle = me.toNativeStyle(style);
          feature.setOptions(validStyle), feature.setVisible(!1), feature.setVisible(_.has(style, "visible") ? !!style.visible : !0);
        },
        _setSelectedStyle: function (style) {
          feature.selStyle = style;
        },
        _getSelectedStyle: function () {
          return feature.selStyle;
        },
        raw: event
      });
    },
    toNativeStyle: function (foreignStyle, modelItem) {
      var conversionTable = {
        fill: "fillColor",
        "fill-opacity": "fillOpacity",
        stroke: "strokeColor",
        "stroke-opacity": "strokeOpacity",
        "stroke-width": "strokeWeight",
        r: "scale",
        "z-index": "zIndex",
        fillColor: "fillColor",
        fillOpacity: "fillOpacity",
        strokeColor: "strokeColor",
        strokeOpacity: "strokeOpacity",
        strokeWidth: "strokeWeight",
        zIndex: "zIndex"
      }, validStyle = {};
      return _.each(foreignStyle, function (value, key) {
        var nativeKey = conversionTable[key];
        if (nativeKey) validStyle[nativeKey] = value; else switch (key) {
          case "visible":
            validStyle.display = value ? !0 : "none";
            break;

          case "icon-url":
            validStyle.icon = value, validStyle.size = new google.maps.Size(foreignStyle.width, foreignStyle.height);
            break;

          case "symbol":
            var symbols = {
              circle: google.maps.SymbolPath.CIRCLE
            }, symbol = symbols[value];
            validStyle.path = _.isUndefined(symbol) ? value : symbol;
            break;

          default:
            validStyle[key] = value;
        }
      }), modelItem && "marker" === modelItem.getFeatureType() && (validStyle.icon || (validStyle = {
        icon: validStyle
      })), validStyle;
    },
    updateItem: function (modelItem) {
      var id = modelItem.get("id"), feature = this.map.data.getFeatureById(id), style = this.toNativeStyle(modelItem.getStyle(), modelItem);
      this.map.data.overrideStyle(feature, style);
    },
    renderMap: function (target) {
      var mapOptions = {
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: !0
      };
      this.map = new google.maps.Map(target, mapOptions), this.addLayers(), this.addControls(),
        this.registerViewportEvents();
    },
    zoomExtends: function () {
      var latlngbounds = new google.maps.LatLngBounds();
      return this.map.data.forEach(function (feature) {
        "Point" == feature.getGeometry().getType() && latlngbounds.extend(feature.getGeometry().get());
      }), latlngbounds.isEmpty() ? !1 : (this.map.setCenter(latlngbounds.getCenter()),
        this.map.fitBounds(latlngbounds), !0);
    },
    renderItem: function (modelItem) {
      if (modelItem) {
        var geoJSON = modelItem.get("geoJSON"), me = this;
        $.when(geoJSON).then(function (feature) {
          if (feature) {
            $.extend(!0, feature, {
              properties: {
                id: modelItem.get("id"),
                model: modelItem
              }
            });
            var importedFeatures = me.map.data.addGeoJson(feature, {
              idPropertyName: "id"
            });
            _.each(importedFeatures, function (f) {
              var style = me.toNativeStyle(modelItem.getStyle(), modelItem);
              me.map.data.overrideStyle(f, style);
            });
          }
        });
      }
    },
    addControls: function () {
      this._addControlHover(), this._addControlZoomBox(), this._addControlBoxSelector(),
        this._addLimitZoomLimits();
    },
    _removeListeners: function () {
      _.each(this.controls.listenersHandle, function (h) {
        h.remove();
      });
    },
    _addControlHover: function () {
      function setStyle(event, action) {
        var modelItem = event.feature.getProperty("model");
        modelItem.setHover("hover" === action);
      }

      var me = this;
      this.map.data.addListener("mouseover", function (e) {
        setStyle(e, "hover");
        var featureType = e.feature.getProperty("model").getFeatureType();
        me.trigger(featureType + ":mouseover", me.wrapEvent(e));
      }), this.map.data.addListener("mouseout", function (e) {
        setStyle(e, "normal");
        var featureType = e.feature.getProperty("model").getFeatureType();
        me.trigger(featureType + ":mouseout", me.wrapEvent(e));
      });
    },
    _addControlZoomBox: function () {
      this.controls.zoomBox = {
        bounds: null,
        gribBoundingBox: null,
        mouseIsDown: !1
      };
    },
    _addControlBoxSelector: function () {
      this.controls.boxSelector = {
        bounds: null,
        gribBoundingBox: null,
        mouseIsDown: !1
      };
    },
    _addControlClick: function () {
      var me = this;
      this.map.data.addListener("click", function (e) {
        var featureType = e.feature.getProperty("model").getFeatureType();
        me.trigger(featureType + ":click", me.wrapEvent(e)), me.trigger("engine:selection:complete");
      });
    },
    _addLimitZoomLimits: function () {
      var minZoom = _.isFinite(this.options.viewport.zoomLevel.min) ? this.options.viewport.zoomLevel.min : 0, maxZoom = _.isFinite(this.options.viewport.zoomLevel.max) ? this.options.viewport.zoomLevel.max : null, me = this;
      google.maps.event.addListener(this.map, "zoom_changed", function () {
        me.map.getZoom() < minZoom ? me.map.setZoom(minZoom) : !_.isNull(maxZoom) && me.map.getZoom() > maxZoom && me.map.setZoom(maxZoom);
      });
    },
    zoomIn: function () {
      this.map.setZoom(this.map.getZoom() + 1);
    },
    zoomOut: function () {
      this.map.setZoom(this.map.getZoom() - 1);
    },
    setPanningMode: function () {
      this._removeListeners();
      var listeners = this.controls.listenersHandle;
      listeners.click = this._toggleOnClick(), listeners.clearOnClick = this._clearOnClick();
    },
    setZoomBoxMode: function () {
      this._removeListeners();
      var me = this, control = this.controls.zoomBox, listeners = this.controls.listenersHandle;
      listeners.click = this._toggleOnClick();
      var onMouseDown = function (e) {
        me.model.isZoomBoxMode() && me._beginBox(control, e);
      };
      listeners.mousedown = google.maps.event.addListener(this.map, "mousedown", onMouseDown),
        listeners.mousedownData = this.map.data.addListener("mousedown", onMouseDown);
      var onMouseMove = function (e) {
        me.model.isZoomBoxMode() && control.mouseIsDown && me._onBoxResize(control, e);
      };
      listeners.mousemove = google.maps.event.addListener(this.map, "mousemove", onMouseMove),
        listeners.mousemoveData = this.map.data.addListener("mousemove", onMouseMove);
      var onMouseUp = this._endBox(control, function () {
        return me.model.isZoomBoxMode();
      }, function (bounds) {
        me.map.fitBounds(bounds);
      });
      listeners.mouseup = google.maps.event.addListener(this.map, "mouseup", onMouseUp),
        listeners.mouseupData = this.map.data.addListener("mouseup", onMouseUp);
    },
    setSelectionMode: function () {
      this._removeListeners();
      var me = this, control = me.controls.boxSelector, listeners = this.controls.listenersHandle;
      listeners.toggleOnClick = this._toggleOnClick();
      var onMouseDown = function (e) {
        me.model.isSelectionMode() && me._beginBox(control, e);
      };
      listeners.mousedown = google.maps.event.addListener(this.map, "mousedown", onMouseDown),
        listeners.mousedownData = this.map.data.addListener("mousedown", onMouseDown);
      var onMouseMove = function (e) {
        me.model.isSelectionMode() && control.mouseIsDown && me._onBoxResize(control, e);
      };
      listeners.mousemove = google.maps.event.addListener(this.map, "mousemove", onMouseMove),
        listeners.mousemoveData = this.map.data.addListener("mousemove", onMouseMove);
      var onMouseUp = this._endBox(control, function () {
        return me.model.isSelectionMode();
      }, function (bounds) {
        me.model.leafs().each(function (m) {
          var id = m.get("id");
          void 0 != me.map.data.getFeatureById(id) && $.when(m.get("geoJSON")).then(function (obj) {
            var geometry = obj.geometry, isWithinArea = isInBounds(geometry, bounds);
            isWithinArea && addToSelection(m);
          });
        }), me.trigger("engine:selection:complete");
      });
      listeners.mouseup = google.maps.event.addListener(this.map, "mouseup", onMouseUp),
        listeners.mouseupData = this.map.data.addListener("mouseup", onMouseUp);
    },
    _clearOnClick: function () {
      var me = this;
      return google.maps.event.addListener(this.map, "click", function (event) {
        clearSelection(me.model), me.trigger("engine:selection:complete");
      });
    },
    _toggleOnClick: function () {
      var me = this;
      return this.map.data.addListener("click", function (event) {
        var modelItem = event.feature.getProperty("model");
        toggleSelection(modelItem), me.trigger("engine:selection:complete");
        var featureType = modelItem.getFeatureType();
        me.trigger(featureType + ":click", me.wrapEvent(event));
      });
    },
    _beginBox: function (control, e) {
      control.mouseIsDown = !0, control.mouseDownPos = e.latLng, this.map.setOptions({
        draggable: !1
      });
    },
    _endBox: function (control, condition, callback) {
      var me = this;
      return function (e) {
        if (condition() && control.mouseIsDown && control.gribBoundingBox) {
          control.mouseIsDown = !1, control.mouseUpPos = e.latLng;
          var bounds = control.gribBoundingBox.getBounds();
          callback(bounds), control.gribBoundingBox.setMap(null), control.gribBoundingBox = null,
            me.map.setOptions({
              draggable: !0
            });
        }
      };
    },
    _onBoxResize: function (control, e) {
      if (null !== control.gribBoundingBox) {
        var bounds = new google.maps.LatLngBounds(control.mouseDownPos, null);
        bounds.extend(e.latLng), control.gribBoundingBox.setBounds(bounds);
      } else control.gribBoundingBox = new google.maps.Rectangle($.extend({
        map: this.map,
        clickable: !1
      }, this.boxStyle));
    },
    unselectPrevShape: function (key, shapes, shapeStyle) {
      var myself = this, prevSelected = this.selectedFeature;
      if (prevSelected && prevSelected[0] !== key) {
        var prevShapes = prevSelected[1], prevStyle = prevSelected[2];
        _.each(prevShapes, function (s) {
          var validStyle = myself.toNativeStyle(prevStyle);
          s.setOptions(validStyle), s.setVisible(!1), s.setVisible(_.has(prevStyle, "visible") ? !!prevStyle.visible : !0);
        });
      }
      this.selectedFeature = [key, shapes, shapeStyle];
    },
    addLayers: function () {
      for (var layers = [], layerIds = [], layerOptions = [], k = 0; k < this.tilesets.length; k++) {
        var thisTileset = this.tilesets[k].slice(0);
        layerIds.push(thisTileset), layerOptions.push({
          mapTypeId: thisTileset
        }), this.tileServices[thisTileset] ? layers.push(this.tileLayer(thisTileset)) : layers.push("");
      }
      for (k = 0; k < layers.length; k++) _.isEmpty(layers[k]) || (this.map.mapTypes.set(layerIds[k], layers[k]),
        this.map.setMapTypeId(layerIds[k]), this.map.setOptions(layerOptions[k]));
    },
    updateViewport: function (centerLongitude, centerLatitude, zoomLevel) {
      zoomLevel || (zoomLevel = this.options.viewport.zoomLevel["default"]), this.map.setZoom(zoomLevel),
      this.zoomExtends() || this.map.panTo(new google.maps.LatLng(38, -9));
    },
    tileLayer: function (name) {
      var options = _.extend({
        tileSize: new google.maps.Size(256, 256),
        minZoom: 1,
        maxZoom: 19
      }, this.tileServicesOptions[name] || {}), urlList = this._switchUrl(this._getTileServiceURL(name)), myself = this;
      return new google.maps.ImageMapType(_.defaults({
        name: name.indexOf("/") >= 0 ? "custom" : name,
        getTileUrl: function (coord, zoom) {
          var limit = Math.pow(2, zoom);
          if (coord.y < 0 || coord.y >= limit) return "404.png";
          coord.x = (coord.x % limit + limit) % limit;
          var url;
          if (_.isArray(urlList)) {
            var s = _.template("${z}/${x}/${y}", {
              x: coord.x,
              y: coord.y,
              z: zoom
            }, {
              interpolate: /\$\{(.+?)\}/g
            });
            url = myself._selectUrl(s, urlList);
          } else url = urlList;
          return _.template(url, {
            x: coord.x,
            y: coord.y,
            z: zoom
          }, {
            interpolate: /\$\{(.+?)\}/g
          });
        }
      }, options));
    },
    showPopup0: function (data, feature, popupHeight, popupWidth, contents, popupContentDiv, borderColor) {
      popupContentDiv && popupContentDiv.length > 0 && (contents = $("#" + popupContentDiv).html());
      var popup = new OurMapOverlay(feature.getGeometry().get(), popupWidth, popupHeight, contents, popupContentDiv, this.map, borderColor);
      this._popups = this._popups || [], _.each(this._popups, function (p) {
        p.setMap(null);
      }), this._popups.push(popup);
    },
    showPopup: function (data, feature, popupHeight, popupWidth, contents, popupContentDiv, borderColor) {
      var popup = new google.maps.InfoWindow({
        content: contents,
        position: feature.getGeometry().get(),
        maxWidth: popupWidth
      });
      this._popups = this._popups || [], _.each(this._popups, function (p) {
        p.close();
      }), popup.open(this.map), this._popups.push(popup);
    },
    registerViewportEvents: function () {
      function wrapViewportEvent() {
        function transformPoint(centerPoint) {
          var center = {
            latitude: centerPoint.lat(),
            longitude: centerPoint.lng()
          };
          return center;
        }

        function getViewport(bounds) {
          viewport = bounds ? {
            northEast: transformPoint(bounds.getNorthEast()),
            southWest: transformPoint(bounds.getSouthWest())
          } : {
            northEast: {},
            southWest: {}
          };
        }

        var viewport = getViewport(this.map.getBounds()), wrappedEvent = {
          zoomLevel: this.map.getZoom(),
          center: transformPoint(this.map.getCenter() || new google.maps.LatLng()),
          viewport: viewport,
          raw: this.map
        };
        return wrappedEvent;
      }

      var me = this, eventMap = {
        zoom_changed: "map:zoom",
        center_changed: "map:center"
      };
      _.each(eventMap, function (mapEvent, engineEvent) {
        google.maps.event.addListener(me.map, engineEvent, function () {
          var wrappedEvent = wrapViewportEvent.call(me);
          me.trigger(mapEvent, wrappedEvent);
        });
      });
    }
  });
}), define("cde/components/Map/addIns/LocationResolver/geonames/geonames", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/lib/jquery"], function (AddIn, Dashboard, $) {
  var geonames = {
    name: "geonames",
    label: "GeoNames",
    defaults: {
      username: "",
      url: "http://ws.geonames.org/searchJSON"
    },
    implementation: function (tgt, st, opt) {
      var location, featureClass, name = st.address;
      name || (st.city ? (name = st.city, featureClass = "P") : st.county ? (name = st.county,
        featureClass = "A") : st.region ? (name = st.region, featureClass = "A") : st.state ? (name = st.state,
        featureClass = "A") : st.country && (name = st.country, featureClass = "A"));
      var params = {
        q: name.replace(/&/g, ","),
        maxRows: 1,
        dataType: "json",
        username: opt.username,
        featureClass: featureClass
      };
      featureClass && (params.featureClass = featureClass);
      var onSuccess = function (result) {
        result.geonames && result.geonames.length > 0 && (location = [parseFloat(result.geonames[0].lng), parseFloat(result.geonames[0].lat)],
          st.continuationFunction(location));
      }, onError = function () {
        st.continuationFunction(void 0);
      };
      return $.ajax({
        dataType: "json",
        url: opt.url,
        method: "GET",
        data: params,
        success: onSuccess,
        error: onError
      });
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "LocationResolver", new AddIn(geonames)),
    geonames;
}), define("cde/components/Map/addIns/LocationResolver/nominatim/nominatim", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/lib/jquery", "amd!cdf/lib/underscore"], function (AddIn, Dashboard, $, _) {
  var nominatim = {
    name: "openstreetmap",
    label: "OpenStreetMap",
    defaults: {
      url: "http://nominatim.openstreetmap.org/search",
      serviceParams: {
        format: "json",
        limit: "1"
      },
      mapping: {
        street: "street",
        postalcode: "postalcode",
        city: "city",
        county: "county",
        state: "state",
        country: "country"
      }
    },
    implementation: function (tgt, st, opt) {
      if (st.latitude || st.longitude) {
        var location = [parseFloat(st.longitude), parseFloat(st.latitude)];
        return void st.continuationFunction(location);
      }
      var params = $.extend(!0, {}, opt.serviceParams);
      _.each(_.keys(st), function (key) {
        if (!_.isFunction(st[key])) {
          var keyLower = key.toLowerCase();
          keyLower in opt.mapping && (params[opt.mapping[keyLower]] = st[key]);
        }
      }), params.q && (params = {
        q: params.q + ", " + _.compact(_.map(opt.mapping, function (field) {
          return params[field];
        })).join(", ")
      });
      var onSuccess = function (result) {
        if (result && result.length > 0) {
          var location = [parseFloat(result[0].lon), parseFloat(result[0].lat)];
          st.continuationFunction(location);
        }
      }, onError = function () {
        st.continuationFunction(void 0);
      };
      return $.ajax({
        dataType: "json",
        method: "GET",
        url: opt.url,
        data: $.extend({}, opt.serviceParams, params),
        success: onSuccess,
        error: onError
      });
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "LocationResolver", new AddIn(nominatim)),
    nominatim;
}), define("cde/components/Map/addIns/LocationResolver/mapquest/mapquest", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/lib/jquery", "amd!cdf/lib/underscore", "../nominatim/nominatim"], function (AddIn, Dashboard, $, _, nominatim) {
  var mapquest = $.extend(!0, {}, nominatim, {
    name: "mapquest",
    label: "MapQuest",
    defaults: {
      url: "http://open.mapquestapi.com/nominatim/v1/search"
    }
  });
  return Dashboard.registerGlobalAddIn("NewMapComponent", "LocationResolver", new AddIn(mapquest)),
    mapquest;
}), define("cde/components/Map/addIns/MarkerImage/cggMarker/cggMarker", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/components/CggComponent.ext"], function (AddIn, Dashboard, CggComponentExt) {
  var cggMarker = {
    name: "cggMarker",
    label: "CGG Marker",
    defaults: {},
    implementation: function (tgt, st, opt) {
      var url = CggComponentExt.getCggDrawUrl() + "?script=" + st.cggGraphName, cggParameters = {};
      st.width && (cggParameters.width = st.width), st.height && (cggParameters.height = st.height),
        cggParameters.noChartBg = !0;
      var parameter;
      for (parameter in st.parameters) cggParameters[parameter] = st.parameters[parameter];
      var level = Dashboard.debug;
      level > 1 && (cggParameters.debug = !0, cggParameters.debugLevel = level);
      for (parameter in cggParameters) void 0 !== cggParameters[parameter] && (url += "&param" + parameter + "=" + encodeURIComponent(cggParameters[parameter]));
      return url;
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "MarkerImage", new AddIn(cggMarker)),
    cggMarker;
}), define("cde/components/Map/Map.ext", [], function () {
  return {
    getMarkerImgPath: function () {
      return CONTEXT_PATH + "api/repos/pentaho-cdf-dd/resources/custom/amd-components/Map/images/";
    }
  };
}), define("cde/components/Map/addIns/MarkerImage/urlMarker/urlMarker", ["cdf/AddIn", "cdf/Dashboard.Clean", "../../../Map.ext"], function (AddIn, Dashboard, NewMapComponentExt) {
  var urlMarker = {
    name: "urlMarker",
    label: "Url Marker",
    defaults: {
      defaultUrl: NewMapComponentExt.getMarkerImgPath() + "marker_grey.png",
      imagePath: NewMapComponentExt.getMarkerImgPath(),
      images: ["marker_grey.png", "marker_blue.png", "marker_grey02.png", "marker_orange.png", "marker_purple.png"]
    },
    implementation: function (tgt, st, opt) {
      return st.url ? st.url : st.position ? opt.imagePath + opt.images[st.position % opt.images.length] || opt.defaultUrl : opt.defaultUrl;
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "MarkerImage", new AddIn(urlMarker)),
    urlMarker;
}), define("cde/components/Map/addIns/ShapeResolver/simpleJSON", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/lib/jquery", "amd!cdf/lib/underscore"], function (AddIn, Dashboard, $, _) {
  function multiPolygonToGeoJSON(latLonMultiPolygon) {
    var lonLatMultiPolygon = _.map(latLonMultiPolygon, function (polygon) {
      return _.map(polygon, function (lineString) {
        return _.map(lineString, function (point) {
          return point.reverse();
        });
      });
    });
    return {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: lonLatMultiPolygon
      },
      properties: {}
    };
  }

  var simpleJSON = {
    name: "simpleJSON",
    label: "Simple JSON shape resolver",
    defaults: {
      url: ""
    },
    implementation: function (tgt, st, opt) {
      var deferred = $.Deferred(), url = opt.url || st._shapeSource;
      return url ? $.ajax(url, {
        async: !0,
        type: "GET",
        dataType: "json",
        success: function (latlonMap) {
          deferred.resolve(_.chain(latlonMap).map(function (multiPolygonLatLon, key) {
            return [key, multiPolygonToGeoJSON(multiPolygonLatLon)];
          }).object().value());
        },
        error: function () {
          deferred.resolve({});
        }
      }) : deferred.resolve(null), deferred.promise();
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "ShapeResolver", new AddIn(simpleJSON)),
    simpleJSON;
}), define("cde/components/Map/addIns/ShapeResolver/kml", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/lib/jquery", "amd!cdf/lib/underscore"], function (AddIn, Dashboard, $, _) {
  function getShapeFromKML(rawData, idSelector, parseShapeKey) {
    var mymap = {};
    return $(rawData).find("Placemark").each(function (idx, y) {
      var key;
      if (_.isFunction(parseShapeKey)) try {
        key = parseShapeKey(y);
      } catch (e) {
        key = $(y).find(idSelector).text();
      } else key = $(y).find(idSelector).text();
      var polygonArray = _.map($(y).find("Polygon"), function (yy) {
        var polygon = [];
        return _.each(["outerBoundaryIs", "innerBoundaryIs"], function (b) {
          var polygonObj = $(yy).find(b + " LinearRing coordinates");
          _.each(polygonObj, function (v) {
            var s = $(v).text().trim();
            if (s.length > 0) {
              var p = _.map(s.split(" "), function (el) {
                return _.map(el.split(",").slice(0, 2), parseFloat);
              });
              polygon.push(p);
            }
          });
        }), polygon;
      });
      _.isEmpty(polygonArray) || mymap[key] || (mymap[key] = multiPolygonToGeoJSON(polygonArray));
    }), mymap;
  }

  function multiPolygonToGeoJSON(polygonArray) {
    var feature = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: polygonArray
      },
      properties: {}
    };
    return feature;
  }

  var kml = {
    name: "kml",
    label: "KML shape resolver",
    defaults: {
      url: "",
      idSelector: "name",
      parseShapeKey: null
    },
    implementation: function (tgt, st, opt) {
      var deferred = $.Deferred(), url = opt.url || st._shapeSource, parseShapeKey = opt.parseShapeKey || st._parseShapeKey;
      return url ? $.ajax(url, {
        async: !0,
        type: "GET",
        processData: !1,
        success: function (data) {
          deferred.resolve(getShapeFromKML(data, opt.idSelector, parseShapeKey));
        },
        error: function () {
          deferred.resolve({});
        }
      }) : deferred.resolve(null), deferred.promise();
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "ShapeResolver", new AddIn(kml)),
    kml;
}), define("cde/components/Map/addIns/ShapeResolver/geoJSON", ["cdf/AddIn", "cdf/Dashboard.Clean", "cdf/Logger", "cdf/lib/jquery", "amd!cdf/lib/underscore"], function (AddIn, Dashboard, Logger, $, _) {
  function toMappedGeoJSON(json, idPropertyName) {
    var map = _.chain(json.features).map(function (feature, idx) {
      var id = getFeatureId(feature, idPropertyName) || idx;
      return [id, feature];
    }).object().value();
    return map;
  }

  function getFeatureId(feature, idPropertyName) {
    var id = feature.id;
    return idPropertyName && (id = feature.properties[idPropertyName] || id), id;
  }

  var geoJSON = {
    name: "geoJSON",
    label: "GeoJSON shape resolver",
    defaults: {
      url: "",
      idPropertyName: ""
    },
    implementation: function (tgt, st, opt) {
      var deferred = $.Deferred(), url = opt.url || st._shapeSource;
      return url ? $.ajax(url, {
        async: !0,
        type: "GET",
        dataType: "json",
        success: function (json) {
          var map = toMappedGeoJSON(json, opt.idPropertyName);
          deferred.resolve(map);
        },
        error: function () {
          Logger.log("NewMapComponent geoJSON addIn: failed to retrieve data at" + url, "debug"),
            deferred.resolve({});
        }
      }) : (Logger.log("NewMapComponent geoJSON addIn: no url is defined", "debug"), deferred.resolve(null)),
        deferred.promise();
    }
  };
  return Dashboard.registerGlobalAddIn("NewMapComponent", "ShapeResolver", new AddIn(geoJSON)),
    geoJSON;
}), define("cde/components/Map/addIns/mapAddIns", ["./LocationResolver/geonames/geonames", "./LocationResolver/nominatim/nominatim", "./LocationResolver/mapquest/mapquest", "./MarkerImage/cggMarker/cggMarker", "./MarkerImage/urlMarker/urlMarker", "./ShapeResolver/simpleJSON", "./ShapeResolver/kml", "./ShapeResolver/geoJSON"], function () {
}),
  define("cde/components/Map/Map", ["cdf/lib/jquery", "amd!cdf/lib/underscore", "cdf/components/UnmanagedComponent", "./Map.lifecycle", "./Map.selector", "./Map.model", "./Map.configuration", "./Map.featureStyles", "./Map.colorMap", "./ControlPanel/ControlPanel", "./Map.tileServices", "./engines/openlayers2/MapEngineOpenLayers", "./engines/google/MapEngineGoogle", "./addIns/mapAddIns", "css!./Map"], function ($, _, UnmanagedComponent, ILifecycle, ISelector, IMapModel, IConfiguration, IFeatureStyle, IColorMap, ControlPanel, tileServices, OpenLayersEngine, GoogleMapEngine) {
    return UnmanagedComponent.extend(ILifecycle).extend(ISelector).extend(IMapModel).extend(IConfiguration).extend(IFeatureStyle).extend(IColorMap).extend(tileServices).extend({
      mapEngine: void 0,
      locationResolver: void 0,
      API_KEY: !1,
      update: function () {
        return this.preExec() ? (this.maybeToggleBlock(!0), this.configuration = this.getConfiguration(),
          void this._initMapEngine().then(_.bind(this.init, this)).then(_.bind(function () {
            this.queryDefinition && !_.isEmpty(this.queryDefinition) ? this.getQueryData() : this.onDataReady(this.testData || {});
          }, this))) : !1;
      },
      onDataReady: function (json) {
        return $.when(this.resolveFeatures(json)).then(_.bind(function (json) {
          this.initModel(json), this._initControlPanel(), this.updateSelection(), this._processMarkerImages();
        }, this)).then(_.bind(this.render, this)).then(_.bind(this._concludeUpdate, this));
      },
      _initMapEngine: function () {
        var options = $.extend(!0, {}, this.configuration.addIns.MapEngine.options, {
          options: this.configuration
        });
        return "google" == this.configuration.addIns.MapEngine.name ? this.mapEngine = new GoogleMapEngine(options) : this.mapEngine = new OpenLayersEngine(options),
          this.mapEngine.init();
      },
      init: function () {
        var $map = $('<div class="map-container"/>');
        $map.css({
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "100%"
        }), $map.appendTo(this.placeholder().empty()), this._relayMapEngineEvents(), this._registerEvents(),
          this.mapEngine.renderMap($map.get(0)), this._initPopup();
      },
      _initControlPanel: function () {
        var $controlPanel = $('<div class="map-controls" />').prependTo(this.placeholder());
        this.controlPanel = new ControlPanel($controlPanel, this.model, this.configuration),
          this.controlPanel.render();
        var me = this, eventMapping = {
          "zoom:in": _.bind(this.mapEngine.zoomIn, this.mapEngine),
          "zoom:out": _.bind(this.mapEngine.zoomOut, this.mapEngine)
        };
        _.each(eventMapping, function (callback, event) {
          _.isFunction(callback) && me.listenTo(me.controlPanel, event, callback);
        });
      },
      render: function () {
        this.mapEngine.render(this.model);
        var centerLatitude = this.configuration.viewport.center.latitude, centerLongitude = this.configuration.viewport.center.longitude, defaultZoomLevel = this.configuration.viewport.zoomLevel["default"];
        this.mapEngine.updateViewport(centerLongitude, centerLatitude, defaultZoomLevel);
      },
      _relayMapEngineEvents: function () {
        var engine = this.mapEngine, component = this, events = ["marker:click", "marker:mouseover", "marker:mouseout", "shape:click", "shape:mouseover", "shape:mouseout", "map:zoom", "map:center"];
        _.each(events, function (event) {
          component.listenTo(engine, event, function () {
            var args = _.union([event], arguments);
            component.trigger.apply(component, args);
          });
        }), this.listenTo(this.mapEngine, "engine:selection:complete", function () {
          component.processChange();
        });
      },
      _registerEvents: function () {
        var me = this;
        this.on("marker:click", function (event) {
          this.model.isPanningMode();
          var result;
          _.isFunction(me.markerClickFunction) && (result = me.markerClickFunction(event)),
          result !== !1 && me.model.isPanningMode() && _.isEmpty(this.parameter) && me.showPopup(event);
        }), this.on("shape:mouseover", function (event) {
          if (_.isFunction(me.shapeMouseOver)) {
            var result = me.shapeMouseOver(event);
            result && (result = _.isObject(result) ? result : {}, event.draw(_.defaults(result, {
              "z-index": 1
            }, event.style)));
          }
        }), this.on("shape:mouseout", function (event) {
          var result = {};
          _.isFunction(me.shapeMouseOut) && (result = me.shapeMouseOut(event)), result = _.isObject(result) ? result : {},
          _.size(result) > 0 && event.draw(_.defaults(result, event.style));
        }), this.on("shape:click", function (event) {
          if (_.isFunction(me.shapeMouseClick)) {
            me.shapeMouseClick(event);
            return;
          }
        });
      },
      _processMarkerImages: function () {
        function processRow(m) {
          var mapping = this.mapping || {}, row = m.get("rawData") || [], st = $.extend(!0, {}, state, {
            data: row,
            position: m.get("rowIdx"),
            height: row[mapping.markerHeight],
            width: row[mapping.markerWidth]
          }), addinName = this.configuration.addIns.MarkerImage.name, extraSt = {}, extraOpts = {};
          "cggMarker" === addinName && (extraSt = {
            cggGraphName: this.configuration.addIns.MarkerImage.options.cggScript,
            parameters: _.object(_.map(this.configuration.addIns.MarkerImage.options.parameters, function (parameter) {
              return [parameter[0], row[mapping[parameter[1]]]];
            }))
          });
          var addIn = this.getAddIn("MarkerImage", addinName);
          if (addIn) {
            $.extend(!0, st, extraSt);
            var opts = $.extend(!0, {}, this.getAddInOptions("MarkerImage", addIn.getName()), extraOpts), markerIcon = addIn.call(this.placeholder(), st, opts);
            _.isObject(markerIcon) ? $.extend(!0, m.attributes.styleMap, markerIcon) : $.extend(!0, m.attributes.styleMap, {
              width: st.width,
              height: st.height,
              "icon-url": markerIcon
            });
          }
        }

        var markersRoot = this.model.findWhere({
          id: "markers"
        });
        if (markersRoot) {
          var state = {
            height: this.configuration.addIns.MarkerImage.options.height,
            width: this.configuration.addIns.MarkerImage.options.width,
            url: this.configuration.addIns.MarkerImage.options.iconUrl
          };
          markersRoot.leafs().each(_.bind(processRow, this)).value();
        }
      },
      _initPopup: function () {
        if (this.popupContentsDiv) {
          var $popupContentsDiv = $("#" + this.popupContentsDiv), $popupDivHolder = $popupContentsDiv.clone();
          this.popupContentsDiv && 1 != $popupContentsDiv.length && this.placeholder().append($popupDivHolder.html("None"));
        }
      },
      showPopup: function (event) {
        var data = event.data || [], me = this;
        if (this.popupContentsDiv || data[me.mapping.popupContents]) {
          _.each(this.popupParameters, function (paramDef) {
            me.dashboard.fireChange(paramDef[1], data[me.mapping[paramDef[0].toLowerCase()]]);
          });
          var height = data[me.mapping.popupContentsHeight] || this.popupHeight, width = data[me.mapping.popupContentsWidth] || this.popupWidth, contents = data[me.mapping.popupContents] || $("#" + this.popupContentsDiv).html(), borderColor = "#394246", isDefaultMarker = _.isUndefined(data.marker) && !this.markerCggGraph && _.isUndefined(me.marker) && "urlMarker" === me.configuration.addIns.MarkerImage.name;
          if (isDefaultMarker) {
            var borderColors = ["#394246", "#11b4eb", "#7a879a", "#e35c15", "#674f73"];
            borderColor = borderColors[event.model.get("rowIdx") % borderColors.length];
          }
          this.mapEngine.showPopup(event.data, event.feature, height, width, contents, this.popupContentsDiv, borderColor);
        }
      }
    });
  });