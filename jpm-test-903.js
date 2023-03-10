(function () {
  function baseDomain(url) {
    var match;
    var baseDomain = "";
    var re = /^(https?:\/\/)?([a-z0-9\-]+\.)*([a-z0-9\-]+\.[a-z0-9]+)/i;
    if (typeof url === "string") {
      match = url.match(re);
      if (match !== null) {
        baseDomain = match[3].toLowerCase();
      }
    }
    return baseDomain;
  }
  var Ajax = {
    method: "POST",
    timeout: 30000,
    withCredentials: true,
    decodeJSON: true,
    stringify: function (obj) {
      return JSON.stringify(obj)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
    },
    serialize: function (obj) {
      var str;
      var params = [];
      if (typeof obj !== "object") return obj;
      for (var param in obj) {
        str = encodeURIComponent(param) + "=" + encodeURIComponent(obj[param]);
        params.push(str);
      }
      return params.join("&").replace(/%20/g, "+");
    },
    submit: function (form, options) {
      var action;
      var formData = {};
      options = options || {};
      if (typeof form === "string") form = document.getElementById(form);
      if (form instanceof HTMLFormElement) {
        for (var i = 0; i < form.elements.length; i++) {
          var el = form.elements[i];
          if (el.name && !el.disabled) {
            var value =
              el.tagName === "SELECT"
                ? el.options[el.selectedIndex].value
                : el.value;
            formData[el.name] = value;
          }
        }
        if (typeof options.data === "object") {
          for (var param in options.data) {
            formData[param] = options.data[param];
          }
        }
        action = options.action || form.action || "";
        options.method = options.method || form.method;
        options.data = formData;
        Ajax.send(action, options);
      }
    },
    send: function (url, options) {
      if (typeof options === "function") options = { onSuccess: options };
      options = options || {};
      var xhr = new XMLHttpRequest();
      var decodeJSON =
        options.decodeJSON != null ? options.decodeJSON : Ajax.decodeJSON;
      var method = options.method
        ? options.method.toUpperCase()
        : Ajax.method.toUpperCase();
      var postData = method === "POST" ? Ajax.serialize(options.data) : null;
      if (method === "GET" && options.data) {
        if (url.indexOf("?") === -1) {
          url += "?";
        } else if (url.length > url.indexOf("?") + 1) {
          url += "&";
        }
        if (typeof options.data === "object") {
          url += Ajax.serialize(options.data);
        } else {
          url += options.data.replace(/^[?&]/, "");
        }
      }
      xhr.open(method, url, true);
      xhr.timeout = options.timeout || Ajax.timeout;
      xhr.withCredentials =
        options.withCredentials != null
          ? options.withCredentials
          : Ajax.withCredentials;
      xhr.onreadystatechange = function () {
        var response, responseHandler;
        if (xhr.readyState === 4) {
          try {
            responseHandler =
              xhr.status < 300 || xhr.status === 304
                ? options.onSuccess
                : options.onFail;
            response =
              decodeJSON == true
                ? JSON.parse(xhr.responseText)
                : xhr.responseText;
          } catch (e) {
            response = xhr.responseText;
          }
          if (typeof responseHandler === "function") {
            responseHandler(response);
          }
          if (typeof options.done === "function") {
            options.done(response);
          }
        }
      };
      if (options.contentType) {
        xhr.setRequestHeader("Content-type", options.contentType);
      } else if (method === "POST") {
        xhr.setRequestHeader(
          "Content-type",
          "application/x-www-form-urlencoded"
        );
      }
      xhr.send(postData);
    },
  };
  var FileLoader = {
    timeout: 6000,
    loading: [],
    loaded: [],
    loadHTML: function (url, container) {
      Ajax.send(url, {
        method: "GET",
        decodeJSON: false,
        withCredentials: false,
        onSuccess: function (response) {
          if (!container) {
            container = document.createElement("div");
            document.body.appendChild(container);
          }
          if (typeof container === "string") {
            container = document.getElementById(container);
          }
          if (container instanceof HTMLElement) {
            container.innerHTML = response;
          }
        },
      });
    },
    loadCSS: function (url, args) {
      var stylesheet = document.createElement("link");
      stylesheet.setAttribute("rel", "stylesheet");
      stylesheet.setAttribute("type", "text/css");
      stylesheet.setAttribute("href", url);
      document.getElementsByTagName("head")[0].appendChild(stylesheet);
      return stylesheet;
    },
    loadScript: function (url, args) {
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src = url;
      args = args || {};
      timeout = args.timeout || FileLoader.timeout;
      if (typeof args.customAttributes === "object") {
        for (var attr in args.customAttributes) {
          script.setAttribute(attr, args.customAttributes[attr]);
        }
      }
      if (script.readyState) {
        script.onreadystatechange = function () {
          var loadingIdx = FileLoader.loading.indexOf(url);
          if (
            script.readyState === "loaded" ||
            script.readyState === "complete"
          ) {
            script.onreadystatechange = null;
            FileLoader.loaded.push(url);
            if (loadingIdx !== -1) FileLoader.loading.splice(loadingIdx, 1);
            if (typeof args.onLoad === "function") args.onLoad();
          }
        };
      } else {
        script.onload = function () {
          var loadingIdx = FileLoader.loading.indexOf(url);
          FileLoader.loaded.push(url);
          if (loadingIdx !== -1) FileLoader.loading.splice(loadingIdx, 1);
          if (typeof args.onLoad === "function") args.onLoad();
        };
      }
      setTimeout(function () {
        var loadingIdx = FileLoader.loading.indexOf(url);
        var loadedIdx = FileLoader.loaded.indexOf(url);
        if (loadingIdx !== -1) FileLoader.loading.splice(loadingIdx, 1);
        if (loadedIdx === -1 && typeof args.onTimeout === "function")
          args.onTimeout();
      }, timeout);
      document.getElementsByTagName("head")[0].appendChild(script);
      return script;
    },
    require: function (url, args) {
      if (
        FileLoader.loaded.indexOf(url) === -1 &&
        FileLoader.loading.indexOf(url) === -1
      ) {
        return FileLoader.loadScript(url, args);
      }
    },
  };
  function MessageRouter(options) {
    var messageHandlers = {};
    var messageValidators = {};
    options = options || {};
    options.debug = true;
    this.createId = function () {
      return Math.random().toString(36).slice(2);
    };
    this.setListener = function (subject, callback, validator) {
      if (typeof callback === "function") messageHandlers[subject] = callback;
      if (typeof validator === "function")
        messageValidators[subject] = validator;
    };
    this.removeListener = function (subject) {
      messageHandlers[subject] = undefined;
      delete messageHandlers[subject];
    };
    this.setOption = function (name, val) {
      options[name] = val;
    };
    this.receive = function (msgEvent) {
      var callbackResult;
      try {
        var postMsg = msgEvent.data;
        var subject = postMsg.subject;
        var validator = messageValidators[subject] || options.validator || null;
        var isValidSource =
          typeof validator != "function" || validator(msgEvent);
        var isValidTarget = subject in messageHandlers;
        var logColor = isValidSource && isValidTarget ? "blue" : "red";
        if (isValidSource) {
          if (options.debug == true && console.groupCollapsed) {
            console.groupCollapsed(
              "%cPostMessage Received <-- " + subject,
              "color: " + logColor + "; font-weight: bold;"
            );
            console.log(postMsg);
          }
          if (isValidTarget) {
            callbackResult = messageHandlers[subject](
              postMsg.content,
              msgEvent
            );
          } else if (options.debug == true) {
            console.log(
              "%cNo message handler found for " + subject,
              "color: red; font-weight: bold;"
            );
          }
          if (postMsg.reply && isValidTarget) {
            this.send(
              postMsg.messageId,
              callbackResult,
              null,
              msgEvent.source,
              msgEvent.origin
            );
          }
        } else if (options.debug == true) {
          console.log(
            "%cMessageRouter ignored message from unknown source.",
            "color: orange; font-weight: bold;"
          );
        }
        if (options.debug == true && console.groupEnd) {
          console.groupEnd();
        }
      } catch (error) {
        console.error(error);
      }
    };
    this.send = function (subject, content, replyHandler, target, origin) {
      var self = this;
      var postMsg = {
        messageId: this.createId(),
        reply: false,
        subject: subject,
        content: content,
      };
      target = target || options.target;
      origin = origin || options.origin;
      if (target && typeof target.postMessage === "function") {
        if (typeof replyHandler === "function") {
          postMsg.reply = true;
          this.setListener(postMsg.messageId, function (reply, msgEvent) {
            if (msgEvent.source === target) {
              replyHandler(reply, msgEvent);
              self.removeListener(postMsg.messageId);
            }
          });
        }
        if (options.debug == true && console.groupCollapsed) {
          console.groupCollapsed(
            "%cPostMessage Sent --> " + subject,
            "color: orange; font-weight: bold;"
          );
          console.log(postMsg);
        }
        target.postMessage(postMsg, origin);
        if (options.debug == true && console.groupEnd) {
          console.groupEnd();
        }
      }
    };
    if (typeof window.postMessage == "function") {
      window.addEventListener("message", this.receive.bind(this), false);
    }
  }
  var scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="hpfParent"]');
  var scriptDomain = baseDomain(scriptEl.src);
  var messageRouter = new MessageRouter({
    validator: function (msgEvent) {
      var hpfFrame = document.querySelector('iframe[src*="/hpf/1_1"]');
      return (
        hpfFrame &&
        baseDomain(msgEvent.origin) === baseDomain(scriptDomain) &&
        msgEvent.origin === hpfFrame.src.substr(0, msgEvent.origin.length)
      );
    },
  });
  messageRouter.setListener("startPayment", function (cbOverride) {
    var result = {};
    try {
      if (typeof window.startPayment === "function") {
        result.returnValue = window.startPayment() || "";
      } else if (
        typeof window.startHostedPayment === "function" &&
        cbOverride == 1
      ) {
        result.returnValue = window.startHostedPayment() || "";
      } else if (
        typeof window.startCREPayment === "function" &&
        cbOverride == 1
      ) {
        result.returnValue = window.startCREPayment() || "";
      } else {
        result.returnValue = "";
      }
    } catch (e) {
      result.exception = e.message;
    }
    return result;
  });
  messageRouter.setListener("cancelPayment", function (cancellationCode) {
    var result = {};
    try {
      if (typeof window.cancelPayment === "function") {
        result.returnValue = window.cancelPayment(cancellationCode) || "";
      } else if (typeof window.cancelHostedPayment === "function") {
        result.returnValue = window.cancelHostedPayment(cancellationCode) || "";
      } else if (typeof window.cancelCREPayment === "function") {
        result.returnValue = window.cancelCREPayment(cancellationCode) || "";
      } else {
        result.returnValue = "";
      }
    } catch (e) {
      result.exception = e.message;
    }
    return result;
  });
  messageRouter.setListener(
    "completePayment",
    function (paymentResult, msgEvent) {
      var result = {};
      try {
        if (typeof window.completePayment === "function") {
          result.returnValue = window.completePayment(paymentResult) || "";
        } else if (typeof window.completeHostedPayment === "function") {
          result.returnValue =
            window.completeHostedPayment(paymentResult) || "";
        } else if (typeof window.completeCREPayment === "function") {
          result.returnValue = window.completeCREPayment(paymentResult) || "";
        } else {
          result.returnValue = "";
        }
      } catch (e) {
        result.exception = e.message;
      }
      return result;
    }
  );
  messageRouter.setListener(
    "handlePaymentErrors",
    function (errorData, msgEvent) {
      var result = {};
      try {
        var errorCodes = errorData.errorCode.join(errorData.delimiter);
        var gatewayCode = decodeURIComponent(errorData.gatewayCode);
        var gatewayMessage = decodeURIComponent(errorData.gatewayMessage);
        delete errorData.delimiter;
        if (typeof window.handlePaymentErrors === "function") {
          result.returnValue = window.handlePaymentErrors(errorData) || "";
        } else if (typeof window.hostedHandleDetailErrors === "function") {
          result.returnValue =
            window.hostedHandleDetailErrors(
              errorCodes,
              gatewayCode,
              gatewayMessage
            ) || "";
        } else if (typeof window.creHandleDetailErrors === "function") {
          result.returnValue =
            window.creHandleDetailErrors(
              errorCodes,
              gatewayCode,
              gatewayMessage
            ) || "";
        } else if (typeof window.hostedHandleErrors === "function") {
          result.returnValue = window.hostedHandleErrors(errorCodes) || "";
        } else if (typeof window.creHandleErrors === "function") {
          result.returnValue = window.creHandleErrors(errorCodes) || "";
        } else {
          alert("Error: " + errorCodes);
          result.returnValue = "";
        }
      } catch (e) {
        result.exception = e.message;
      }
      return result;
    }
  );
  messageRouter.setListener("whatsThis", function (type, msgEvent) {
    var result = {};
    try {
      if (typeof window.whatsThis === "function") {
        result.returnValue = window.whatsThis(type) || "";
      } else if (type == "cvv" && typeof window.whatCVV2 === "function") {
        result.returnValue = window.whatCVV2() || "";
      } else {
        result.returnValue = "";
      }
    } catch (e) {
      result.exception = e.message;
    }
    return result;
  });
  messageRouter.setListener("scrollRelay", function (position, msgEvent) {
    if (typeof window.top.scrollRelay === "function") {
      window.top.scrollRelay(position.scrollX, position.scrollY);
    }
  });
  messageRouter.setListener("init", function (data, msgEvent) {
    var status = { origin: window.top.location.origin, callbacks: {} };
    messageRouter.setOption("target", msgEvent.source);
    messageRouter.setOption("origin", msgEvent.origin);
    if (typeof window.top.startPayment == "function") {
      status.callbacks.startPayment = "startPayment";
    } else if (typeof window.top.startHostedPayment == "function") {
      status.callbacks.startPayment = "startHostedPayment";
    } else if (typeof window.top.startCREPayment == "function") {
      status.callbacks.startPayment = "startCREPayment";
    }
    if (typeof window.top.cancelPayment == "function") {
      status.callbacks.cancelPayment = "cancelPayment";
    } else if (typeof window.top.cancelHostedPayment == "function") {
      status.callbacks.cancelPayment = "cancelHostedPayment";
    } else if (typeof window.top.cancelCREPayment == "function") {
      status.callbacks.cancelPayment = "cancelCREPayment";
    }
    if (typeof window.top.completePayment == "function") {
      status.callbacks.completePayment = "completePayment";
    } else if (typeof window.top.completeHostedPayment == "function") {
      status.callbacks.completePayment = "completeHostedPayment";
    } else if (typeof window.top.completeCREPayment == "function") {
      status.callbacks.completePayment = "completeCREPayment";
    }
    if (typeof window.handlePaymentErrors === "function") {
      status.callbacks.handleErrors = "handlePaymentErrors";
    } else if (typeof window.hostedHandleDetailErrors === "function") {
      status.callbacks.handleErrors = "hostedHandleDetailErrors";
    } else if (typeof window.creHandleDetailErrors === "function") {
      status.callbacks.handleErrors = "creHandleDetailErrors";
    } else if (typeof window.hostedHandleErrors === "function") {
      status.callbacks.handleErrors = "hostedHandleErrors";
    } else if (typeof window.creHandleErrors === "function") {
      status.callbacks.handleErrors = "creHandleErrors";
    } else {
      status.callbacks.handleErrors = "default";
    }
    if (typeof window.top.whatsThis == "function") {
      status.callbacks.whatsThis = "whatsThis";
      status.callbacks.whatsThis = "whatsThis";
    } else if (typeof window.top.whatCVV2 == "function") {
      status.callbacks.whatsThis = "whatCVV2";
    }
    if (typeof window.top.scrollRelay == "function") {
      status.callbacks.scrollRelay = "scrollRelay";
    }
    if (typeof window.top.hpfReady == "function") {
      status.callbacks.hpfReady = "hpfReady";
      try {
        window.top.hpfReady();
      } catch (e) {
        status.exception = e.message;
      }
    }
    return status;
  });
})();
