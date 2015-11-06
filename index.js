/*
 Change log:
 1. Aded ReactDom.
 2. Changed getDOMNode() with ReactDOM.findDOMNode()
 */

var ReactDOM = require('react-dom');

/* UTIL FUNCTIONS */
// @credits https://gist.github.com/rogozhnikoff/a43cfed27c41e4e68cdc
function findInArray(array, callback) {
  for (var i = 0, length = array.length; i < length; i++) {
    if (callback.apply(callback, [array[i], i, array])) return array[i];
  }
}

function isFunction(func) {
  return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]';
}

function selectorTest(el, selector) {
  var matchesSelectorFunc = findInArray([
    'matches',
    'webkitMatchesSelector',
    'mozMatchesSelector',
    'msMatchesSelector',
    'oMatchesSelector'
  ], function(method){
    return isFunction(el[method]);
  });
  return el[matchesSelectorFunc].call(el, selector);
}

var listMixin = {
  componentWillMount: function() {
    // Set movable props
    // This should transfer to `ItemComponent` in `ListComponent`
    this.movableProps = {
      bindMove: this.bindMove,
      unbindMove: this.unbindMove,
      resort: this.resort
    };
  },
  getClientForEvent: function(e, key){
    if(e.type.search('touch') > -1){
      e.preventDefault();
      return e.touches[0][key];
    }else{
      return e[key];
    }
  },
  // movedComponent: component to move
  // moveElemEvent: mouse event object triggered on moveElem
  bindMove: function(movedComponent, moveElemEvent) {
    //Add options to work without compulsary state "items" condition
    var moveElem = ReactDOM.findDOMNode(movedComponent)
      , placeholder = movedComponent.placeholder
      , parentPosition = moveElem.parentElement.getBoundingClientRect()
      , moveElemPosition = moveElem.getBoundingClientRect()
      , viewport = document.body.getBoundingClientRect()
      , maxOffset = viewport.right - parentPosition.left - moveElemPosition.width
    // , offsetX = moveElemEvent.clientX - moveElemPosition.left
    // , offsetY = moveElemEvent.clientY - moveElemPosition.top;
      , offsetX = this.getClientForEvent( moveElemEvent, 'clientX') - moveElemPosition.left
      , offsetY = this.getClientForEvent( moveElemEvent, 'clientY') - moveElemPosition.top
      , savedInlineStyles = {};

    savedInlineStyles = {
      position: moveElem.style.position,
      zIndex: moveElem.style.zIndex,
      left: moveElem.style.left,
      top: moveElem.style.top
    };

    // (Keep width) currently manually set in `onMoveBefore` if necessary,
    // due to unexpected css box model
    // moveElem.style.width = moveElem.offsetWidth + 'px';
    moveElem.parentElement.style.position = 'relative';
    moveElem.style.position = 'absolute';
    moveElem.style.zIndex = '100';
    // Keep the initialized position in DOM
    moveElem.style.left = (moveElemPosition.left - parentPosition.left) + 'px';
    moveElem.style.top = (moveElemPosition.top - parentPosition.top) + 'px';

    // Place here to customize/override styles
    if (this.onMoveBefore) {
      this.onMoveBefore(moveElem);
    }

    this.moveHandler = function(e) {
      var clientX = this.getClientForEvent(e, 'clientX')
        , clientY = this.getClientForEvent(e, 'clientY')
        , left = clientX - parentPosition.left - offsetX
        , top = clientY - parentPosition.top - offsetY
        , siblings
        , sibling
        , compareRect
        , i, len;
      if (left > maxOffset) {
        left = maxOffset;
      }

      //Movement Contstrain
      var settings = this.props.settings || {};
      if (typeof settings.dragY == "undefined" || (typeof settings.dragY == "boolean" && settings.dragY)) {
        moveElem.style.top = top + 'px';
      }

      if (typeof settings.dragX == "undefined" || (typeof settings.dragX == "boolean" && settings.dragX)) {
        moveElem.style.left = left + 'px';
      }

      // Loop all siblings to find intersected sibling
      siblings = moveElem.parentElement.children;
      for (i = 0, len = siblings.length; i < len; i++) {
        sibling = siblings[i];
        if (sibling !== this.intersectItem &&
          sibling !== moveElem) {
          compareRect = sibling.getBoundingClientRect();
          if (clientX > compareRect.left &&
            clientX < compareRect.right &&
            clientY > compareRect.top &&
            clientY < compareRect.bottom) {
            if (sibling !== placeholder) {
              movedComponent.insertPlaceHolder(sibling);
            }
            this.intersectItem = sibling;
            break;
          }
        }
      }
      e.stopPropagation();
    }.bind(this);

    // Stop move
    this.mouseupHandler = function() {
      var el = moveElem
        , parentElem = el.parentElement
        , children = parentElem.children
        , newIndex, elIndex;

      newIndex = Array.prototype.indexOf.call(children, placeholder);
      elIndex = Array.prototype.indexOf.call(children, el);
      // Subtract self
      if (newIndex > elIndex) {
        newIndex -= 1;
      }

      // Clean DOM
      el.style.position = savedInlineStyles.position;
      el.style.zIndex = savedInlineStyles.zIndex;
      el.style.left = savedInlineStyles.left;
      el.style.top = savedInlineStyles.top;
      parentElem.removeChild(placeholder);

      this.unbindMove();
      this.resort(movedComponent.props.index, newIndex);
    }.bind(this);

    // To make handler removable, DO NOT `.bind(this)` here, because
    // > A new function reference is created after .bind() is called!
    if (movedComponent.movable) {
      ReactDOM.findDOMNode(this).addEventListener('mousemove', this.moveHandler);
      ReactDOM.findDOMNode(this).addEventListener('touchmove', this.moveHandler);
    }
    // Bind to `document` to be more robust
    document.addEventListener('mouseup', this.mouseupHandler);
    document.addEventListener('touchend', this.mouseupHandler);
  },
  unbindMove: function() {
    ReactDOM.findDOMNode(this).removeEventListener('mousemove', this.moveHandler);
    document.removeEventListener('mouseup', this.mouseupHandler);
    ReactDOM.findDOMNode(this).removeEventListener('touchmove', this.moveHandler);
    document.removeEventListener('touchend', this.mouseupHandler);
    this.intersectItem = null;
    if (this.onMoveEnd) {
      this.onMoveEnd();
    }
  },
  resort: function(oldPosition, newPosition) {
    var items, movedItem;
      if (oldPosition !== newPosition) {
      if(this.onGetItems)
        items = this.onGetItems();
      else
        throw ("onGetItems is not set!");
      // First: remove item from old position
      movedItem = items.splice(oldPosition, 1)[0];
      // Then add to new position
      items.splice(newPosition, 0, movedItem);
      if (this.onResorted) {
        this.onResorted(items, oldPosition, newPosition);
      }
    }
  }
};

var itemMixin = {
  componentDidMount: function() {
    ReactDOM.findDOMNode(this).addEventListener('mousedown', this.moveSetup);
    ReactDOM.findDOMNode(this).addEventListener('touchstart', this.moveSetup);
    this.setMovable(true);
  },
  insertPlaceHolder: function(el) {
    // Move forward, insert before `el`
    // Move afterward, insert after `el`
    var parentEl = el.parentElement
      , elIndex = Array.prototype.indexOf.call(parentEl.children, el)
      , newIndex = Array.prototype.indexOf.call(parentEl.children, this.placeholder);
    parentEl.insertBefore(this.placeholder,
      newIndex > elIndex ? el : el.nextSibling);
  },
  createPlaceHolder: function(el) {
    el = el || ReactDOM.findDOMNode(this);
    this.placeholder = el.cloneNode(false);
    this.placeholder.removeAttribute('data-reactid');
    this.placeholder.style.opacity = '0';
    this.placeholder.style.height = el.offsetHeight + 'px';
  },
  moveSetup: function(e) {
    if(this.props.handle && !selectorTest(e.target, this.props.handle)){
      return;
    }
    var el = ReactDOM.findDOMNode(this);
    this.createPlaceHolder(el);

    this.props.bindMove(this, e);
    this.insertPlaceHolder(el);
    this.intersectItem = null;
    // For nested movable list
    e.stopPropagation();
  },
  setMovable: function(movable) {
    this.movable = movable;
  }
};

exports.ListMixin = listMixin;
exports.ItemMixin = itemMixin;
