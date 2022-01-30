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
    // Note
    else if (localStorage.getItem('schemaVersion') === '1') {
      let size;
      // Note
      try {
        const sizeRaw = localStorage.getItem('configSize');
        size = typeof sizeRaw === 'string' && JSON.parse(sizeRaw);
      } catch (e) {
        console.log('Recovered from error parsing saved config:');
        console.error(e);
      }
      // Note
      const sizeInt = parseInt(size, 10);
      if (sizeInt >=0 && sizeInt <=4) {
        this.state.config.size = String(sizeInt);
      }
    }
  },
  persist() {
    const config = this.state.config;
    localStorage.setItem('cm_fireworks_data', JSON.stringify({
      schemaVersion: '1.2',
      data: {
        quality: config.quality,
        size: config.size,
        skyLighting: config.skyLighting,
        scaleFactor: config.scaleFactor
      }
    }));
  }
};

if (!IS_HEADER) {
  store.load();
}

// function updateConfig(nextConfig) {
//   nextConfig = nextConfig || getConfigFromDOM();
//   store.setState({
//     config: Object.assign({}, store.state.config, nextConfig)
//   });
//
//   configDidUpdate();
// }
// Note
function configDidUpdate() {
  const config = store.state.config;
  quality = qualitySelector();
  isLowQuality = quality === QUALITY_LOW;
  isNormalQuality = quality === QUALITY_NORMAL;
  isHighQuality = quality === QUALITY_HIGH;

  if (skyLightingSelector() === SKY_LIGHT_NONE) {
    appNodes.canvasContainer.style.backgroundColor = '#000';
  }

  Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}

// Note
const qualitySelector = () => +store.state.config.quality;
const shellNameSelector = () => store.state.config.shell;
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;

const helpContent = {
  shellType: {
    header: 'Shell Type',
    body: 'The type of firework that will be launched, Select "Random" for a nice assortment!'
  },
  shellSize: {
    header: 'Shell Size',
    body: 'The size of the firework. Modeled after real firework shell sizes,' +
        ' larger shells have bigger bursts with more stars, and sometimes more complex effects.' +
        ' However, larger shells also require more processing power and may cause lag.'
  },
  quality: {
    header: 'Quality',
    body: 'Overall graphics quality. If the animation is not animation is not running smoothly, ' +
        'try lowering the quality. High quality greatly increases the amount of sparks rendered and may cause lag.'
  },
  skyLighting: {
    header: 'Sky Lighting',
    body: 'Illuminates the background as fireworks explode. If the background looks too bright on your screen, ' +
        'try setting it to "Dim" or "None".'
  },
  scaleFactor: {
    header: 'Scale',
    body: 'Allows scaling the size of all fireworks, essentially moving you closer or farther away. ' +
        'For larger shell sizes, it can be convenient to decrease the scale a bit, especially on phones or tablets.'
  },
  autoLaunch: {
    header: 'Auto Fire',
    body: 'Launches sequences of fireworks automatically. Sit back and enjoy the show, or disable to have full control.'
  },
  finaleMode: {
    header: 'Final Mode',
    body: 'Launches intense bursts of fireworks. May cause lag. Requires "Auto Fire" to be enabled.'
  },
  hideControls: {
    header: 'Hide Controls',
    body: 'Hides the translucent controls along the top of the screen.'
  },
  fullscreen: {
    header: 'Fullscreen',
    body: 'Toggles fullsreen mode.'
  },
  longExposure: {
    header: 'Open Shutter',
    body: 'Experimental effect that preserves long streaks of light, similar to leaving a camera shutter open.'
  }
};

const nodeKeyToHelpKey = {
  shellTypeLabel: 'shellType',
  shellSizeLabel: 'shellSize',
  qualityLabel: 'quality',
  skyLightingLabel: 'skyLighting',
  scaleFactorLabel: 'scaleFactor',
  autoLaunchLabel: 'autoLaunch',
  finaleModelLabel: 'finaleMode',
  hideControlsLabel: 'hideControls',
  fullscreenLabel: 'fullscreen',
  logExposureLabel: 'longExposure'
};

// Note
const appNodes = {
  stageContainer: '.state-container',
  canvasContainer: '.canvas-container'
}

// Convert appNodes selectors to dom nodes
Object.keys(appNodes).forEach(key => {
  appNodes[key] = document.querySelector(appNodes[key]);
});

// First render is called in init()
// function renderApp(state) {
//   // appNodes.canvasContainer.classList.toggle('blur', )
//
// }

// Line 509 Constant derivations
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);
// Note
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
// Note
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
  obj[code] = i;
  return obj
}, {});
// Note
const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.substr(1, 2), 16),
    g: parseInt(hex.substr(3, 2), 16),
    b: parseInt(hex.substr(5, 2), 16)
  };
});

// Note
function randomColorSimple() {
  return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

// Note
let lastColor;
function randomColor(options) {
  const notSame = options && options.notSame;
  const notColor = options && options.notColor;
  const limitWhite = options && options.limitWhite;
  let color = randomColorSimple();

  // Note
  if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple();
  }

  if (notSame) {
    while (color === lastColor) {
      color = randomColorSimple();
    }
  } else if (notColor) {
    while (color === notColor) {
      color = randomColorSimple();
    }
  }

  lastColor = color;
  return color;
}

function whiteOrGold() {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

// Shell helpers
function makePistilColor(shellColor) {
  return (shellColor === COLOR.White || shellColor === COLOR.Gold)
      ? randomColor({notColor: shellColor}) : whiteOrGold();
}

// Node
const crysanthemumShell = (size = 1) => {
  const glitter = Math.random() < 0.25;
  const singleColor = Math.random() < 0.72;
  const color = singleColor
      ? randomColor({limitWhite: true})
      : [randomColor(), randomColor({notSame: true})];
  const pistil = singleColor && Math.random() < 0.42;
  const pistilColor = pistil && makePistilColor(color);
  const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White)
      ? pistilColor || randomColor({notColor: color, limitWhite: true})
      : null;
  const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
  let starDensity = glitter ? 1.1 : 1.25;
  if (isLowQuality) starDensity *= 0.8;
  if (isHighQuality) starDensity = 1.2;
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starDensity,
    color,
    secondColor,
    glitter: glitter ? 'light' : '',
    glitterColor: whiteOrGold(),
    pistil,
    pistilColor,
    streamers
  };
};

const ghostShell = (size = 1) => {
  // Extend crysanthemum shell
  const shell = crysanthemumShell(size);
  shell.starLife *= 1.5;
  let ghostColor = randomColor({notColor: COLOR.White});
  shell.streamers = true;
  const pistil = Math.random() < 0.42;
  const pistilColor = pistil && makePistilColor(ghostColor);
  shell.color = INVISIBLE;
  shell.secondColor = ghostColor;
  shell.glitter = '';

  return shell;
};

const strobeShell = (size = 1) => {
  const color = randomColor({limitWhite: true});
  return {
    shellSize: size,
    spreadSize: 280 + size * 92,
    starLife: 1100 + size * 200,
    starLifeVariation: 0.40,
    starDensity: 1.1,
    color,
    glitter: 'light',
    glitterColor: COLOR.White,
    strobe: true,
    strobeColor: Math.random() < 0.5 ? COLOR.White : null,
    pistil: Math.random() < 0.5,
    pistilColor: makePistilColor(color)
  };
};

const palmShell = (size = 1) => {
  const color = randomColor();
  const thick = Math.random() < 0.5;
  return {
    shellSize: size,
    color,
    spreadSize: 250 + size * 75,
    starDensity: thick ? 0.15 : 0.4,
    starLife: 1000 + size * 200,
    glitter: thick ? 'thick' : 'heavy'
  };
};

const ringShell = (size = 1) => {
  const color = randomColor();
  const pistil = Math.random() < 0.75;
  return {
    shellSize: size,
    ring: true,
    color,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starCount: 2.2 * PI_2 * (size + 1),
    pistil,
    pistilColor: makePistilColor(color),
    glitter: !pistil ? 'light' : '',
    glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
    streamers: Math.random() < 0.3
  };
};

const crossetteShell = (size = 1) => {
  const color = randomColor({limitWhite: true});
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 750 + size * 160,
    starLifeVariation: 0.4,
    starDensity: 0.85,
    color,
    crossette: true,
    pistil: Math.random() < 0.5,
    pistilColor: makePistilColor(color)
  };
};

const floralShell = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  color: Math.random() < 0.65
      ? 'random'
      : (Math.random() < 0.15
          ? randomColor()
          : [randomColor(), randomColor({notSame: true})]),
  floral: true
});

const fallingLeavesShell = (size = 1) => ({
  shellSize: size,
  color: INVISIBLE,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  glitter: 'medium',
  glitterColor: COLOR.Gold,
  fallingLeaves: true
});

const willowShell = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 100,
  starDensity: 0.6,
  starLife: 3000 + size * 300,
  glitter: 'willow',
  glitterColor: COLOR.Gold,
  color: INVISIBLE
});

const crackleShell = (size = 1) => {
  const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
  return {
    shellSize: size,
    spreadSize: 300 + size * 75,
    starDensity: isLowQuality ? 0.65 : 1,
    starLife: 600 + size * 100,
    starLifeVariation: 0.32,
    glitter: 'light',
    glitterColor: COLOR.Gold,
    color,
    crackle: true,
    pistil: Math.random() < 0.65,
    pistilColor: makePistilColor(color)
  };
};

const horsetailShell = (size = 1) => {
  const color = randomColor();
  return {
    shellSize: size,
    horsetail: true,
    color,
    spreadSize: 250 + size * 38,
    starDensity: 0.9,
    starLife: 2500 + size * 300,
    glitter: 'medium',
    glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
    strobe: color === COLOR.White
  };
};

function randomShellName() {
  return Math.random() < 0.5 ? 'Crysanthemum' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
  if (IS_HEADER) return randomFastShell()(size);

  return shellTypes[randomShellName()][size];
}

// Note line 771
const fastShellBlackList = ['Falling Leaves', 'Floral', 'Willow'];
function randomFastShell() {
  let shellName = randomShellName();

  while (fastShellBlackList.includes(shellName)) {
    shellName = randomShellName();
  }

  return shellTypes[shellName];
}

const shellTypes = {
  'Random': randomShell,
  'Crackle': crackleShell,
  'Crossette': crossetteShell,
  'Crysanthemum': crysanthemumShell,
  'Falling Leaves': fallingLeavesShell,
  'Floral': floralShell,
  'Ghost': ghostShell,
  'Horse Tail': horsetailShell,
  'Palm': palmShell,
  'Ring': ringShell,
  'Strobe': strobeShell,
  'Willow': willowShell
}

const shellNames = Object.keys(shellTypes);

function init() {
  document.querySelector('.loading-init').remove();
  appNodes.stageContainer.classList.remove('remove');
}

function fitShellPositionInBoundsH(position) {
  const edge = 0.18;
  return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
  return position * 0.75;
}

function getRandomShellPositionH() {
  return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
  return fitShellPositionInBoundsV(Math.random());
}

function getRandomShellSize() {
  const baseSize = IS_MOBILE ? 4 : 12;
  const maxVariance = Math.min(2.5, baseSize);
  const variance = Math.random() * maxVariance;
  const size = baseSize - variance;
  const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
  const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
  const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;

  return {
    size,
    x : fitShellPositionInBoundsH(x),
    height: fitShellPositionInBoundsV(height)
  };
}

function seqRandomShell() {
  const size = getRandomShellSize();
  const shell = new Shell(randomShell(size.size));
  shell.launch(size.x, size.height);

  let extraDelay = shell.starLife;
  if (shell.fallingLeaves) {
    extraDelay = 4600;
  }

  return 900 + Math.random() * 600 + extraDelay;
}

function seqRandomFastShell() {
  const shellType = randomFastShell();
  const size = getRandomShellSize();
  const shell = new Shell(shellType(size.size));
  shell.launch(size.x, size.height);

  let extraDelay = shell.starLife;
  return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom() {
  const size1 = getRandomShellSize();
  const size2 = getRandomShellSize();
  const shell1 = new Shell(randomShell(size1.size));
  const shell2 = new Shell(randomShell(size2.size));
  const leftOffset = Math.random() * 0.2 - 0.1;
  const rightOffset = Math.random() * 0.2 - 0.1;
  shell1.launch(0.3 + leftOffset, size1.height);
  setTimeout(() => {
    shell2.launch(0.7 + rightOffset, size2.height);
  }, 100);

  let extraDelay = Math.max(shell1.starLife, shell2.starLife);
  if (shell1.fallingLeaves || shell2.fallingLeaves) {
    extraDelay = 4600;
  }

  return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple() {
  const shellType = randomFastShell();
  const baseSize = 8;
  const smallSize = Math.max(0, baseSize - 1.25);

  const offset = Math.random() * 0.08 - 0.04;
  const shell1 = new Shell(shellType(baseSize));
  shell1.launch(0.5 + offset, 0.7);

  const leftDelay = 1000 + Math.random() * 400;
  const rightDelay = 1000 + Math.random() * 400;

  setTimeout(() => {
    const offset = Math.random() * 0.08 - 0.04;
    const shell2 = new Shell(shellType(smallSize));
    shell2.launch(0.2 + offset, 0.1);
  }, leftDelay);

  setTimeout(() => {
    const offset = Math.random() * 0.08 - 0.04;
    const shell3 = new Shell(shellType(smallSize));
    shell3.launch(0.8 + offset, 0.1);
  }, rightDelay);

  return 4000;
}

function seqPyramid() {
  const barrageCountHalf = IS_DESKTOP ? 7 : 4;
  const largeSize = shellSizeSelector();
  const smallSize = Math.max(0, largeSize - 3);
  const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
  const randomSpecialShell = randomShell;

  function launchShell(x, useSpecial) {
    const isRandom = shellNameSelector() === 'Random';
    let shellType = isRandom
        ? useSpecial ? randomSpecialShell : randomMainShell
        : shellTypes[shellNameSelector()];
    const shell = new Shell(shellType((useSpecial ? largeSize : smallSize)));
    const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
    shell.launch(x, useSpecial ? 0.75 : height * 0.42);
  }

  let count = 0;
  let delay = 0;
  while(count <= barrageCountHalf) {
    if (count === barrageCountHalf) {
      setTimeout(() => {
        launchShell(0.5, true);
      }, delay);
    } else {
      const offset = count / barrageCountHalf * 0.5;
      const delayOffset = Math.random() * 30 + 30;
      setTimeout(() => {
        launchShell(offset, false);
      }, delay);
      setTimeout(() => {
        launchShell(1 - offset, false);
      }, delay + delayOffset);
    }

    count ++;
    delay += 200;
  }

  return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage() {
  seqSmallBarrage.lastCalled = Date.now();
  const barrageCount = IS_DESKTOP ? 11 : 5;
  const specialIndex = IS_DESKTOP ? 3 : 1;
  const shellSize = Math.max(0, shellSizeSelector() - 2);
  const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
  const randomSpecialShell = randomFastShell;

  function launchShell(x, useSpecial) {
    const isRandom = shellNameSelector() === 'Random';
    let shellType = isRandom
        ? useSpecial ? randomSpecialShell : randomMainShell
        : shellTypes[shellNameSelector()];
    const shell = new Shell(shellType(shellSize));
    const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
    shell.launch(x, height * 0.75);
  }

  let count = 0;
  let delay = 0;
  while(count < barrageCount) {
    if (count === 0) {
      launchShell(0.5, false);
      count += 1;
    } else {
      const offset = (count + 1) / barrageCount / 2;
      const delayOffset = Math.random() * 30 + 30;
      const useSpecial = count === specialIndex;
      setTimeout(() => {
        launchShell(0.5 + offset, useSpecial);
      }, delay);
      setTimeout(() => {
        launchShell(0.5 - offset, useSpecial);
      }, delay + delayOffset);
      count += 2;
    }

    delay += 200;
  }

  return 3400 + barrageCount * 120;
}
seqSmallBarrage.coolddown = 15000;
seqSmallBarrage.lastCalled = Date.now();

const sequences = [
    seqRandomShell,
    seqTwoRandom,
    seqTriple,
    seqPyramid,
    seqSmallBarrage
];

let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;
function startSequence() {
  if (isFirstSeq) {
    isFirstSeq = false;
    if (IS_HEADER) {
      return seqTwoRandom();
    } else {
      const shell = new Shell(crysanthemumShell(shellSizeSelector()));
      shell.launch(0.5, 0.5);
      return 2400;
    }
  }
}