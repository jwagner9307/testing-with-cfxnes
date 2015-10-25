// jscs:disable requireDotNotation

import logger from '../../../core/src/utils/logger';
import { arrayToProperties } from '../../../core/src/utils/arrays';
import { forEachProperty, getProperty, setProperty } from '../../../core/src/utils/objects';

export const ports = [1, 2];
export const sourceIds = ['keyboard', 'mouse', 'gamepad'];
export const targetIds = ['joypad', 'zapper'];

//=========================================================
// Input manager
//=========================================================

export default class InputManager {

  constructor() {
    this.dependencies = ['nes', 'deviceFactory'];
  }

  inject(nes, deviceFactory) {
    logger.info('Initializing input manager');
    this.nes = nes;
    this.deviceFactory = deviceFactory;
    this.initSources();
    this.initTargets();
    this.setDefaults();
  }

  setDefaults() {
    logger.info('Using default input configuration');
    this.clearMapping();
    this.connectTarget(1, 'joypad');
    this.connectTarget(2, 'zapper');
    this.mapInput(1, 'joypad', 'a',       'keyboard', 'c');
    this.mapInput(1, 'joypad', 'b',       'keyboard', 'x');
    this.mapInput(1, 'joypad', 'start',   'keyboard', 'enter');
    this.mapInput(1, 'joypad', 'select',  'keyboard', 'shift');
    this.mapInput(1, 'joypad', 'up',      'keyboard', 'up');
    this.mapInput(1, 'joypad', 'down',    'keyboard', 'down');
    this.mapInput(1, 'joypad', 'left',    'keyboard', 'left');
    this.mapInput(1, 'joypad', 'right',   'keyboard', 'right');
    this.mapInput(2, 'zapper', 'trigger', 'mouse',    'left');
  }

  //=========================================================
  // Source input devices
  //=========================================================

  initSources() {
    this.sources = {};
    for (var id of sourceIds) {
      logger.info(`Registering source input device "${id}"`);
      this.sources[id] = this.deviceFactory.createSourceDevice(id);
    }
  }

  readSourcesState() {
    var state = {};
    for (var id in this.sources) {
      var source = this.sources[id];
      if (source.readState) {
        source.readState(state);
      }
    }
    return state;
  }

  //=========================================================
  // Target input devices
  //=========================================================

  initTargets() {
    this.targets = {};
    for (var port of ports) {
      this.targets[port] = {};
      for (var id of targetIds) {
        logger.info(`Registering target input device "${id}" on port ${port}`);
        this.targets[port][id] = this.deviceFactory.createTargetDevice(id);
      }
    }
  }

  connectTarget(port, id) {
    if (this.getConnectedTarget(port) !== id) {
      logger.info(`Setting target input device on port ${port} to "${id || 'none'}"`);
      var device = id != null ? this.targets[port][id].getDevice() : null;
      this.nes.connectInputDevice(port, device);
    }
  }

  getConnectedTarget(port) {
    var targetsOnPort = this.targets[port];
    for (var id in targetsOnPort) {
      var target = targetsOnPort[id];
      if (this.nes.getConnectedInputDevice(port) === target.getDevice()) {
        return id;
      }
    }
  }

  updateTargetsState(state) {
    for (var port in this.targets) {
      var targetsOnPort = this.targets[port];
      for (var id in targetsOnPort) {
        var target = targetsOnPort[id];
        if (target.stateChanged) {
          target.stateChanged(state);
        }
      }
    }
  }

  //=========================================================
  // Input processing
  //=========================================================

  processInput(sourceId, sourceInput, inputDown) {
    if (this.isRecording()) {
      if (!inputDown) {
        this.finishRecording(sourceId, sourceInput);
      }
      return true;
    } else {
      return this.forwardInput(sourceId, sourceInput, inputDown);
    }
  }

  forwardInput(sourceId, sourceInput, inputDown) {
    var targetParams = getProperty(this.targetsMapping, sourceId, sourceInput);
    if (targetParams) {
      var [ targetPort, targetId, targetInput ] = targetParams;
      this.targets[targetPort][targetId].inputChanged(targetInput, inputDown);
      return true;
    }
    return false;
  }

  //=========================================================
  // Input state update
  //=========================================================

  updateState() {
    this.updateTargetsState(this.readSourcesState());
  }

  //=========================================================
  // Input recording
  //=========================================================

  recordInput(callback) {
    logger.info('Recording input');
    this.recordCallback = callback;
  }

  isRecording() {
    return this.recordCallback != null;
  }

  finishRecording(sourceId, sourceInput) {
    logger.info(`Caught input "${sourceInput}" from "${sourceId}"`);
    this.recordCallback(sourceId, sourceInput);
    this.recordCallback = null;
  }

  //=========================================================
  // Input mapping
  //=========================================================

  clearMapping() {
    this.sourcesMapping = {}; // Mapping between sources and targets (target -> source)
    this.targetsMapping = {}; // Mapping between sources and targets (source -> target)
  }

  mapInput(targetPort, targetId, targetInput, sourceId, sourceInput) {
    logger.info(`Mapping "${sourceInput}" of "${sourceId}" to "${targetInput}" of "${targetId}" on port ${targetPort}`);
    this.unmapInput(targetPort, targetId, targetInput, sourceId, sourceInput);
    setProperty(this.sourcesMapping, targetPort, targetId, targetInput, [sourceId, sourceInput]);
    setProperty(this.targetsMapping, sourceId, sourceInput, [targetPort, targetId, targetInput]);
  }

  unmapInput(targetPort, targetId, targetInput, sourceId, sourceInput) {
    var sourceParams = getProperty(this.sourcesMapping, targetPort, targetId, targetInput);
    var targetParams = getProperty(this.targetsMapping, sourceId, sourceInput);
    setProperty(this.sourcesMapping, targetPort, targetId, targetInput, null);
    setProperty(this.targetsMapping, sourceId, sourceInput, null);
    if (targetParams) {
      setProperty(this.sourcesMapping, targetParams[0], targetParams[1], targetParams[2], null);
    }
    if (sourceParams) {
      setProperty(this.targetsMapping, sourceParams[0], sourceParams[1], null);
    }
  }

  getMappedInputName(targetPort, targetId, targetInput) {
    var sourceParams = getProperty(this.sourcesMapping, targetPort, targetId, targetInput);
    if (sourceParams) {
      var [ sourceId, sourceInput ] = sourceParams;
      return this.sources[sourceId].getInputName(sourceInput);
    }
  }

  //=========================================================
  // Configuration
  //=========================================================

  readConfiguration(config) {
    logger.info('Reading input configuration');
    config['inputDevices'] = arrayToProperties(ports, this.getConnectedTarget, this);
    config['inputMapping'] = this.targetsMapping;

  }

  writeConfiguration(config) {
    logger.info('Writing input configuration');
    if (config['inputDevices'] !== undefined) {
      forEachProperty(config['inputDevices'], this.connectTarget, this);
    }
    if (config['inputMapping'] !== undefined) {
      this.clearMapping();
      forEachProperty(config['inputMapping'], (sourceId, sourceInputs) => {
        forEachProperty(sourceInputs, (sourceInput, targetParams) => {
          if (targetParams) {
            var [ targetPort, targetId, targetInput ] = targetParams;
            this.mapInput(targetPort, targetId, targetInput, sourceId, sourceInput);
          }
        }, this);
      }, this);
    }
  }

}