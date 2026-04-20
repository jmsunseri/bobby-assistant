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

#include <pebble.h>
#include <pebble-events/pebble-events.h>

#include "root_window.h"
#include "talking_lobster_layer.h"
#include "converse/session_window.h"
#include "menus/root_menu.h"
#include "util/logging.h"
#include "util/style.h"
#include "util/memory/malloc.h"
#include "util/memory/sdk.h"
#include "vibes/haptic_feedback.h"

static const char* const PRV_GREETINGS[] = {
  "Hey!",
  "Yo!",
  "Sup?",
  "Hiya!",
  "Hello!",
  "Hej!",
  "Hola!",
  "Heyo!",
  "Howdy!",
  "Oi!",
};
#define PRV_GREETINGS_COUNT 10

struct RootWindow {
  Window* window;
  ActionBarLayer* action_bar;
  SessionWindow* session_window;
  GBitmap* question_icon;
  GBitmap* dictation_icon;
  GBitmap* more_icon;
  TalkingLobsterLayer* talking_lobster_layer;
  EventHandle app_message_handle;
  char** sample_prompts;
  bool talking_lobster_overridden;
};

static void prv_window_load(Window* window);
static void prv_window_appear(Window* window);
static void prv_window_disappear(Window* window);
static void prv_click_config_provider(void *context);
static void prv_prompt_clicked(ClickRecognizerRef recognizer, void *context);
static void prv_more_clicked(ClickRecognizerRef recognizer, void* context);
static void prv_up_clicked(ClickRecognizerRef recognizer, void *context);
static int prv_load_suggestions(char*** suggestions);
static void prv_action_menu_closed(ActionMenu *action_menu, const ActionMenuItem *performed_action, void *context);
static void prv_suggestion_clicked(ActionMenu *action_menu, const ActionMenuItem *action, void *context);
static void prv_app_message_handler(DictionaryIterator *iter, void *context);

RootWindow* root_window_create() {
  RootWindow* rw = bmalloc(sizeof(RootWindow));
  memset(rw, 0, sizeof(RootWindow));
  rw->window = bwindow_create();
  window_set_window_handlers(rw->window, (WindowHandlers) {
    .load = prv_window_load,
    .appear = prv_window_appear,
    .disappear = prv_window_disappear,
  });
  window_set_user_data(rw->window, rw);
  return rw;
}

void root_window_push(RootWindow* window) {
  window_stack_push(window->window, true);
}

void root_window_destroy(RootWindow* window) {
  window_destroy(window->window);
  free(window);
}

Window* root_window_get_window(RootWindow* window) {
  return window->window;
}

static void prv_window_load(Window *window) {
  // RootWindow* root_window = (RootWindow*)window_get_user_data(window);
}

static void prv_window_appear(Window* window) {
  size_t heap_size = heap_bytes_free();
  RootWindow* rw = window_get_user_data(window);
  GRect bounds = layer_get_bounds(window_get_root_layer(rw->window));
  window_set_background_color(rw->window, COLOR_FALLBACK(ACCENT_COLOUR, GColorWhite));
  rw->question_icon = bgbitmap_create_with_resource(RESOURCE_ID_QUESTION_ICON);
  rw->dictation_icon = bgbitmap_create_with_resource(RESOURCE_ID_DICTATION_ICON);
  rw->more_icon = bgbitmap_create_with_resource(RESOURCE_ID_MORE_ICON);
  rw->action_bar = baction_bar_layer_create();
  action_bar_layer_set_context(rw->action_bar, rw);
  action_bar_layer_set_icon(rw->action_bar, BUTTON_ID_UP, rw->question_icon);
  action_bar_layer_set_icon(rw->action_bar, BUTTON_ID_SELECT, rw->dictation_icon);
  action_bar_layer_set_icon(rw->action_bar, BUTTON_ID_DOWN, rw->more_icon);
  action_bar_layer_add_to_window(rw->action_bar, window);
  action_bar_layer_set_click_config_provider(rw->action_bar, prv_click_config_provider);
#ifdef PBL_ROUND
  rw->talking_lobster_layer = talking_lobster_layer_create(GRect(0, 0, bounds.size.w, bounds.size.h));
#else
  rw->talking_lobster_layer = talking_lobster_layer_create(GRect(0, 0, bounds.size.w - ACTION_BAR_WIDTH, bounds.size.h));
#endif
  layer_add_child(window_get_root_layer(rw->window), (Layer *)rw->talking_lobster_layer);
  rw->talking_lobster_overridden = false;
  const char* greeting = PRV_GREETINGS[rand() % PRV_GREETINGS_COUNT];
  talking_lobster_layer_set_text(rw->talking_lobster_layer, greeting);

  if (!rw->app_message_handle) {
    rw->app_message_handle = events_app_message_register_inbox_received(prv_app_message_handler, rw);
  }
  CLAWD_LOG(APP_LOG_LEVEL_DEBUG, "Window appeared. Heap usage increased %d bytes", heap_size - heap_bytes_free());
}

static void prv_window_disappear(Window* window) {
  size_t heap_size = heap_bytes_free();
  RootWindow* rw = window_get_user_data(window);
  if (rw->app_message_handle) {
    events_app_message_unsubscribe(rw->app_message_handle);
  }
  action_bar_layer_destroy(rw->action_bar);
  gbitmap_destroy(rw->question_icon);
  gbitmap_destroy(rw->dictation_icon);
  gbitmap_destroy(rw->more_icon);
  talking_lobster_layer_destroy(rw->talking_lobster_layer);
  CLAWD_LOG(APP_LOG_LEVEL_DEBUG, "Window disappeared. Heap usage decreased %d bytes", heap_bytes_free() - heap_size);
}

static void prv_app_message_handler(DictionaryIterator *iter, void *context) {
  RootWindow* rw = context;
  Tuple *tuple = dict_find(iter, MESSAGE_KEY_COBBLE_WARNING);
  if (!tuple) {
    return;
  }
  if (tuple->value->int32 == 1) {
    rw->talking_lobster_overridden = true;
    talking_lobster_layer_set_text(rw->talking_lobster_layer, "Uh oh!");
    window_set_background_color(rw->window, COLOR_FALLBACK(GColorRed, GColorDarkGray));
    vibe_haptic_feedback();
  }
}

static void prv_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, prv_up_clicked);
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_prompt_clicked);
  window_single_click_subscribe(BUTTON_ID_DOWN, prv_more_clicked);
}

static void prv_up_clicked(ClickRecognizerRef recognizer, void *context) {
  RootWindow* rw = context;
  // talking_lobster_layer_set_text(rw->talking_lobster_layer, "I'm doing thanks! How help?");
  char **suggestions;
  int count = prv_load_suggestions(&suggestions);
  ActionMenuLevel *level = baction_menu_level_create(count);
  for (int i = 0; i < count; ++i) {
    action_menu_level_add_action(level, suggestions[i], prv_suggestion_clicked, rw);
  }
  ActionMenuConfig config = (ActionMenuConfig) {
    .root_level = level,
    .colors = {
      .background = BRANDED_BACKGROUND_COLOUR,
      .foreground = gcolor_legible_over(BRANDED_BACKGROUND_COLOUR),
    },
    .align = ActionMenuAlignTop,
    .context = rw,
    .did_close = prv_action_menu_closed,
  };
  rw->sample_prompts = suggestions;
  action_menu_open(&config);
}

static void prv_action_menu_closed(ActionMenu *action_menu, const ActionMenuItem *performed_action, void *context) {
  RootWindow* rw = context;
  action_menu_hierarchy_destroy(action_menu_get_root_level(action_menu), NULL, NULL);
  // memory is allocated for sample_prompts[0], but not the rest of the entries - so just free the first one.
  free(rw->sample_prompts[0]);
  free(rw->sample_prompts);
}

static void prv_suggestion_clicked(ActionMenu *action_menu, const ActionMenuItem *action, void *context) {
  RootWindow* rw = context;
  char* suggestion = action_menu_item_get_label(action);
  session_window_push(0, suggestion);
}

static void prv_prompt_clicked(ClickRecognizerRef recognizer, void *context) {
  session_window_push(0, NULL);
}

static void prv_more_clicked(ClickRecognizerRef recognizer, void* context) {
  root_menu_window_push();
}

static int prv_load_suggestions(char*** suggestions) {
  ResHandle handle = resource_get_handle(RESOURCE_ID_SAMPLE_PROMPTS);
  size_t size = resource_size(handle);
  char* buffer = bmalloc(size);
  resource_load(handle, (uint8_t*)buffer, size);
  int count = 1;
  for (size_t i = 0; i < size; ++i) {
    if (buffer[i] == '\n') {
      ++count;
    }
  }
  *suggestions = bmalloc(sizeof(char*) * count);
  for (int i = 0; i < count; ++i) {
    (*suggestions)[i] = buffer;
    buffer = strchr(buffer, '\n');
    if (buffer) {
      *buffer = '\0';
      ++buffer;
    }
  }
  return count;
}
