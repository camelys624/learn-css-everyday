'use strict';
console.clear();

/**
 *  这是一个典型的例子，开始时只是一个简单的项目
 * 然后滚雪球般的超出了它的预期规模。它有点笨重
 * 但无论如何，这就是它 :)
 * https://codepen.io/MillerTime/pen/XgpNwb?editors=0010
 */

const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;

// 检测高性能设备，这将是一个移动的目标
const IS_HIGH_END_DEVICE = (() => {
  const hwConcurrency = navigator.hardwareConcurrency;  // 应该是获取的核心数
  if (!hwConcurrency) {
    return false;
  }

  // 大屏幕表明是全尺寸的计算机，现在的计算机往往有超线程
  // 所以一台四核台式机有 8 个内核。我们会在那里设置一个较高的最小阈值
  const minCount = window.innerWidth <= 1024 ? 4 : 8;
  return hwConcurrency >= minCount;
})();

// 防止画布在屏幕尺寸上变得太大
// 8k - 如果需要，可以限制这个数字
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9;  // 加速度，单位为px/s
let simSpeed = 1;

function getDefaultScaleFactor() {
  if (IS_MOBILE) return 0.9;
  if (IS_HEADER) return 0.75;
  return 1;
}

// 考虑到比例的宽度/高度值
// 用这些来绘制位置
let stageW, stageH;

// 所有高质量的 globals 将被覆盖，并通过 `configDidUpdate`更新
let quality = 1;
let isLowQuality = false;
let isNormalQuality = true;
let isHighQuality = false;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;

const COLOR = {
  Red: '#ff0043',
  Green: '#14fc56',
  Blue: '#1e7fff',
  Purple: '#e60aff',
  Gold: '#ffbf36',
  White: '#ffffff'
};

// 特殊的不可见的颜色(未渲染的和不在 COLOR 字典中的 )
const INVISIBLE = '_INVISIBLE_';

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

// Stage.disableHighDPI = true;
const trailsStage = new Stage('trails-canvas');
const mainStage = new Stage('main-canvas');
const stages = [
  trailsStage,
  mainStage
];

// Fullscreen helpers, using Fscreen for prefixes
function fullscreenEnabled() {
  return fscreen.fullscreenEnabled;
}

// Note here
function isFullscreen() {
  return !!fscreen.fullscreenElement;
}

// Note
function toggleFullscreen() {
  if (fullscreenEnabled()) {
    if (isFullscreen()) {
      fscreen.exitFullscreen();
    } else {
      fscreen.requestFullscreen(document.documentElement);
    }
  }
}

// Note
fscreen.addEventListener('fullscreenchange', () => {
  StorageEvent.setState({fullscreen: isFullscreen()});
});

// Note
const store = {
  _listeners: new Set(),
  _dispatch(prevState) {
    this._listeners.forEach(listener => listener(this.state, prevState))
  },
  state: {
    // Note
    paused: true,
    soundEnabled: false,
    menuOpen: false,
    openHelpTopic: null,
    fullscreen: isFullscreen(),
    // Note
    config: {
      quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL),  // Note
      shell: 'Random',
      size: IS_DESKTOP
        ? '3' // Desktop default
        : IS_HEADER
          ? '1.2' // Profile header default (doesn't need to be an int)
          : '2',  // Mobile default
      autoLaunch: true,
      finale: false,
      skyLighting: SKY_LIGHT_NORMAL + '',
      hideControls: IS_HEADER,
      longExposure: false,
      scaleFactor: getDefaultScaleFactor()
    }
  },
  setState(nextState) {
    const prevState = this.state;
    this.state = Object.assign({}, this.state, nextState);
    this._dispatch(prevState);
    this.persist();
  },
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.remove(listener);
  },
  // Note
  load() {
    const serializedData = localStorage.getItem('cm_fireworks_data');
    if (serializedData) {
      const {schemaVersion, data} = JSON.parse(serializedData);

      const config = this.state.config;
      switch(schemaVersion) {
        case '1.1': 
          config.quality = data.quality;
          config.size = data.size;
          config.skyLighting = data.skyLighting;
          break;
        case '1.2':
          config.quality = data.quality;
          config.size = data.size;
          config.skyLighting = data.skyLighting;
          config.scaleFactor = data.scaleFactor;
          break;
        default:
          throw new Error('version switch should be exhaustive');
      }
      console.log(`Loaded config (schema version ${schemaVersion})`);
    }
  }
}
