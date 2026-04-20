/*
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

#ifndef TALKING_LOBSTER_LAYER_H
#define TALKING_LOBSTER_LAYER_H

#include <pebble.h>

typedef Layer TalkingLobsterLayer;

TalkingLobsterLayer *talking_lobster_layer_create(GRect frame);
void talking_lobster_layer_destroy(TalkingLobsterLayer *layer);
void talking_lobster_layer_set_text(TalkingLobsterLayer *layer, const char *text);

#endif //TALKING_LOBSTER_LAYER_H
