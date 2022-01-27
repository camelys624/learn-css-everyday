'use strict';
console.clear();

/**
 *  这是一个典型的例子，开始时只是一个简单的项目
 * 然后滚雪球般的超出了它的预期规模。它有点笨重
 * 但无论如何，这就是它 :)
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

