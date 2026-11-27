/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This function will be serialised and sent into another context, so it cannot reference anything
// that is not textually inside it.
module.exports = function(minified) {
    var clayConfig = this;
    var PAID_MODELS = {
        '@cf/deepseek-ai/deepseek-v4.1-flash-1017': true,
        '@cf/thinkingmachines/inkling-2-small': true,
        '@cf/zai-org/glm-5.3': true
    };
    var FREE_DEFAULT = '@cf/google/gemma-4-26b-a4b-it';

    clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function() {
        var paid = clayConfig.getItemById('cfPaid');
        var model = clayConfig.getItemById('cfModel');

        function applyPaidFilter() {
            if (!paid || !model) {
                return;
            }
            var paidOn = !!paid.get();
            var select = model.$manipulatorTarget[0];
            if (!select || !select.options) {
                return;
            }
            for (var i = 0; i < select.options.length; i++) {
                var option = select.options[i];
                var isPaid = !!PAID_MODELS[option.value];
                var hide = !paidOn && isPaid;
                option.disabled = hide;
                option.hidden = hide;
                option.style.display = hide ? 'none' : '';
            }
            if (!paidOn && PAID_MODELS[model.get()]) {
                model.set(FREE_DEFAULT);
            }
        }

        if (paid && model) {
            paid.on('change', applyPaidFilter);
            applyPaidFilter();
        }

        var show = clayConfig.getItemById('showSecrets');
        var secrets = clayConfig.getItemsByGroup('secret');

        function applySecretVisibility() {
            if (!show) {
                return;
            }
            var visible = !!show.get();
            for (var i = 0; i < secrets.length; i++) {
                var input = secrets[i].$manipulatorTarget[0];
                if (input) {
                    input.type = visible ? 'text' : 'password';
                }
            }
        }

        if (show) {
            show.on('change', applySecretVisibility);
            applySecretVisibility();
        }
    });
};
