let count = 1;
let container = document.querySelector('.container');

function getUserAction(e) {
  container.innerHTML = count ++;
}

function debounce(func, wait, immediate) {
  let timeout, result;
  let debounced = function() {
    let context = this;
    let args = arguments;

    if(timeout) clearTimeout(timeout);

    if (immediate) {
      // 如果已经执行过，不再执行
      let callNow = !timeout;
      timeout = setTimeout(function() {
        timeout = null;
      }, wait);
      if (callNow) result = func.apply(context ,args);
    } else {
      timeout = setTimeout(function() {
        func.apply(context, arguments);
      }, wait);
    }

    return result;
  }

  debounced.cancel = function () {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}

const setUseAction = debounce(getUserAction, 10000, true);

container.onmousemove = setUseAction;

document.querySelector('.button').addEventListener('click', function() {
  setUseAction.cancel();
})