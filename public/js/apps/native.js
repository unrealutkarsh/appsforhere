(function (x) {
    "use strict";

    x.PPBridge = function () {
        var actions = {},
            handlers = {},
            callbacks = {},
            actionCount = 0,
            callbacksCount = 1,
            options = {},
            self,
            wait = 0,
            commandQueue = [],
            timeoutValue = 100,
            timeout,
            bridgeInitTimeout = 25,
            ready = false,

            /**
             * prepare all the variables and configuration for the bridge
             *    @param
             *        args {string|object}
             *                if string, this is the action id
             *                else, this is the option object
             */
            prepare = function (args) {
                var actionId,
                    hasCallback,
                    callbackId;

                if (typeof args === "string") {
                    actionId = args;
                    args = actions[actionId];
                }
                else if (typeof args === "object") {
                    actionId = actionCount++;
                    actions[actionId] = args;
                }

                options.actionId = actionId;
                options.functionName = args.f;
                if (args.a) {
                    options.callback = args.a.cb || "";
                }
                options.config = args.a || "";

                hasCallback = options.callback && typeof options.callback === "function";
                callbackId = hasCallback ? callbacksCount++ : 0;

                if (hasCallback) {
                    callbacks[callbackId] = options.callback;
                    actions[actionId]["cb"] = callbackId;
                }
                else {
                    callbackId = options.callback;
                }

                return ({
                    "callbackId": callbackId,
                    "options": options,
                    "actionId": actionId
                });
            };


        return {
            /**
             * initialize all arguments
             *  @param
             *        args {object}
             */
            init: function (args) {
                function _init() {
                    if (args) {
                        actions = args.actions;
                        handlers = args.handlers;
                        callbacks = args.callbacks;
                    }

                    function methodCall(func, actionId) {
                        window.location = "jsr://" + func + "/" + actionId;
                    }

                    /* do this only with the PayPal Client */
                    if (window.ppIOS) {
                        ppIOS.methodCall = methodCall;
                    }
                    /* we are now ready for executing bridge calls */
                    ready = true;
                }

                self = this;
                setTimeout(function () {
                    _init();
                }, bridgeInitTimeout);
            },

            /**
             * the native calls this method to pass the result back
             * to the web and will take the result and execute the callback function
             *  @params
             *        callbackId    {string}    the id of the callback
             *        result        {object}    object literal for the result
             */
            getResult: function (callbackId, result) {
                //callbacks[callbackId] && callbacks[callbackId].apply(callbacks[callbackId], [result]);

                var callback = callbacks[callbackId];
                if (!callback) return;

                callback.apply(callback, [result]);
            },

            /**
             * the client calls this method to handle
             * control from the buttons.
             *    @param
             *        handlerTag {number}    the tag for the action handler
             *
             *  @return
             *        true if the handler is executed
             *        false if the handler is not found in the handler table
             */
            callHandler: function (handlerTag) {
                //handlers[handlerTag] && handlers[handlerTag].apply(handlers[handlerTag], []);

                var handler = handlers[handlerTag],
                    returnValue = "";
                if (!handler) return 'false';

                // when the handler is called, the client native app
                // can check whether the callHandler executed or not
                // with our implementation the client will expect 'true' to be returned

                returnValue = handler.apply(handler, []);
                if ((typeof returnValue === "undefined") || returnValue) {
                    return 'true';
                }
                else {
                    return 'false';
                }
            },

            /**
             * the native code will get the action based from the id sent through the
             * url protocol -> jsr://Action/actionId
             *  @params
             *        actionId {string}    the id of the action
             *  @return
             *        string representation of the action object
             */
            getAction: function (actionId) {
                if (!actionId || actionId == "*") return JSON.stringify(actions);
                var action = actions[actionId];
                if (!action) return;
                return JSON.stringify(action);
            },

            /**
             * call the NativeBridge to perform the native to web communication
             *    @param
             *        arguments    {object}            the arguments that make up the communication request
             */
            call: function (args) {
                function _execute(args) {
                    var executeParam = prepare(args);
                    self.execute(executeParam.callbackId, executeParam.options);
                };

                if (!ready) {
                    setTimeout(function () {
                        self.call(args);
                    }, bridgeInitTimeout);
                    return false;
                }

                if (wait) {
                    commandQueue.push(args);

                    // double check the commandQueue specially in the interval to make
                    // sure we are not making multiple instances of the interval
                    if (commandQueue.length > 0) {
                        clearInterval(timeout);
                        timeout = setInterval(function () {
                            if (commandQueue.length > 0) {
                                _execute(commandQueue.shift());
                            }
                            else {
                                clearInterval(timeout);
                            }
                        }, timeoutValue);
                    }

                    return false;
                }
                else {
                    wait = 1;
                    setTimeout(function () {
                        wait = 0;
                    }, timeoutValue);
                    _execute(args);
                }
            },

            execute: function (callbackId, options) {
                if (window.ppAndroid && window.ppAndroid.methodCall) {
                    ppAndroid.methodCall(options.functionName, JSON.stringify(options.config));
                }
                else if (window.ppIOS && window.ppIOS.methodCall) {
                    ppIOS.methodCall(options.functionName, options.actionId);
                }
                else {
                    try {
                        window.external.notify(JSON.stringify({f: options.functionName, a: options.config}));
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
            }
        };
    }();

    // for backwards compatibility with the client app because it is using $.NativeBridge as the reference
    // preserve $ because the client might be using jQuery
    if (x.$) {
        x.$.NativeBridge = x.PPBridge;
    }
    else {
        x.$ = {
            NativeBridge: x.PPBridge
        };
    }
}(window));

var PayPalApp = $.NativeBridge,
    merchantConfig = {
        actions: {
            /**
             * action for setting the TitleBar, Left Button (Back), the Right Button is disregarded because the PayPal Client App controls it
             * when the back button is clicked, the PayPal Client App will call handler tag 3
             */
            "MerchantTitleBar": {
                f: "SetTitleBar",
                a: {
                    WindowTitle: window.document.title,
                    LeftButton: {
                        text: "Back",
                        type: "BACK",
                        tag: 3
                    }
                }
            }
        },
        handlers: {
            1: function (e) {
                PayPalApp.call({f: "DismissWebView"});
                return true;
            },
            3: function (e) {
                window.history.back();
                return true;
            }
        },
        callbacks: {}
    };

// Set the MerchantTitleBar when the DOM is ready or the content is loaded
// this is the native implementation of the item number 2 in the How To Use section, simply uncomment the line below.
// You can also call PayPalApp.call({ActionID}) anywhere in your script for your specific needs

document.addEventListener("DOMContentLoaded", function () {
    // Initialize the actions, handlers and callbacks
    PayPalApp.init(merchantConfig);
    PayPalApp.call("MerchantTitleBar");
}, false);
