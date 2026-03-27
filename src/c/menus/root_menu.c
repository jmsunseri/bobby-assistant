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

#include "root_menu.h"
#include "alarm_menu.h"
#include "about_window.h"
#include "legal_window.h"
#include "reminders_menu.h"
#include "../util/style.h"
#include "../util/memory/malloc.h"
#include "../util/memory/sdk.h"
#include "../util/logging.h"
#include <pebble.h>

#define NUM_MENU_ITEMS 4

static void prv_window_load(Window* window);
static void prv_window_unload(Window* window);
static void prv_push_alarm_screen(int index, void* context);
static void prv_push_timer_screen(int index, void* context);
static void prv_push_about_screen(int index, void* context);
static void prv_push_legal_screen(int index, void* context);
static void prv_push_reminders_screen(int index, void* context);
static uint16_t prv_get_num_rows(MenuLayer *menu_layer, uint16_t section_index, void *context);
static void prv_draw_row(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context);
static void prv_select_click(MenuLayer *menu_layer, MenuIndex *cell_index, void *context);

typedef void (*MenuItemCallback)(int index, void *context);

typedef struct {
  const char *title;
  MenuItemCallback callback;
  uint32_t icon_resource_id;
  GBitmap *icon;
} MenuItemInfo;

static MenuItemInfo s_menu_items[NUM_MENU_ITEMS] = {
  { "Alarms", prv_push_alarm_screen, RESOURCE_ID_MENU_ICON_ALARMS, NULL },
  { "Timers", prv_push_timer_screen, RESOURCE_ID_MENU_ICON_TIMERS, NULL },
  { "Reminders", prv_push_reminders_screen, RESOURCE_ID_MENU_ICON_REMINDERS, NULL },
  { "About", prv_push_about_screen, RESOURCE_ID_MENU_ICON_ABOUT, NULL },
};

typedef struct {
  MenuLayer *menu_layer;
  StatusBarLayer *status_bar;
} RootMenuWindowData;

void root_menu_window_push() {
  Window* window = bwindow_create();
  RootMenuWindowData* data = bmalloc(sizeof(RootMenuWindowData));
  window_set_user_data(window, data);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = prv_window_load,
    .unload = prv_window_unload,
  });

  window_stack_push(window, true);
}

static void prv_window_load(Window* window) {
  CLAWD_LOG(APP_LOG_LEVEL_DEBUG_VERBOSE, "Loading root menu window...");
  // Load icons if not already loaded
  for (int i = 0; i < NUM_MENU_ITEMS; i++) {
    if (s_menu_items[i].icon == NULL) {
      s_menu_items[i].icon = bgbitmap_create_with_resource(s_menu_items[i].icon_resource_id);
    }
  }

  RootMenuWindowData* data = window_get_user_data(window);
  Layer* root_layer = window_get_root_layer(window);
  GRect window_bounds = layer_get_frame(root_layer);
  data->status_bar = bstatus_bar_layer_create();
  clawd_status_bar_config(data->status_bar);
  layer_add_child(root_layer, status_bar_layer_get_layer(data->status_bar));

  GRect menu_frame = GRect(0, STATUS_BAR_LAYER_HEIGHT, window_bounds.size.w, window_bounds.size.h - STATUS_BAR_LAYER_HEIGHT);
  data->menu_layer = bmenu_layer_create(menu_frame);
  menu_layer_set_callbacks(data->menu_layer, window, (MenuLayerCallbacks) {
    .get_num_rows = prv_get_num_rows,
    .draw_row = prv_draw_row,
    .select_click = prv_select_click,
  });
  menu_layer_set_highlight_colors(data->menu_layer, SELECTION_HIGHLIGHT_COLOUR, gcolor_legible_over(SELECTION_HIGHLIGHT_COLOUR));
#ifdef PBL_ROUND
  menu_layer_set_center_focused(data->menu_layer, true);
#endif
  layer_add_child(root_layer, menu_layer_get_layer(data->menu_layer));
  menu_layer_set_click_config_onto_window(data->menu_layer, window);
  CLAWD_LOG(APP_LOG_LEVEL_DEBUG_VERBOSE, "Root menu window loaded");
}

static void prv_window_unload(Window* window) {
  RootMenuWindowData* data = window_get_user_data(window);
  menu_layer_destroy(data->menu_layer);
  status_bar_layer_destroy(data->status_bar);
  for (int i = 0; i < NUM_MENU_ITEMS; i++) {
    if (s_menu_items[i].icon) {
      gbitmap_destroy(s_menu_items[i].icon);
      s_menu_items[i].icon = NULL;
    }
  }
  free(data);
  window_destroy(window);
}

static uint16_t prv_get_num_rows(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return NUM_MENU_ITEMS;
}

static void prv_draw_row(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context) {
  MenuItemInfo *item = &s_menu_items[cell_index->row];
#ifdef PBL_ROUND
  // On round displays, draw icon and text centered together
  GRect bounds = layer_get_bounds(cell_layer);
  int icon_size = 25;
  int text_width = 100;

  // Calculate positions to center icon + text together
  int total_width = icon_size + 8 + text_width;
  int start_x = (bounds.size.w - total_width) / 2;
  if (start_x < 10) start_x = 10;

  // Center the icon vertically in the cell
  int icon_y = (bounds.size.h - icon_size) / 2;
  graphics_context_set_compositing_mode(ctx, GCompOpSet);
  graphics_draw_bitmap_in_rect(ctx, item->icon, GRect(start_x, icon_y, icon_size, icon_size));

  // Draw text next to icon - adjust y to align tops with icon
  // The text baseline is about 4 pixels below the top of the font
  int text_y = icon_y - 4;
  graphics_draw_text(ctx, item->title,
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    GRect(start_x + icon_size + 8, text_y, text_width, icon_size),
    GTextOverflowModeTrailingEllipsis,
    GTextAlignmentLeft,
    NULL);
#else
  // On rectangular displays, use standard menu cell with icon
  menu_cell_basic_draw(ctx, cell_layer, item->title, NULL, item->icon);
#endif
}

static void prv_select_click(MenuLayer *menu_layer, MenuIndex *cell_index, void *context) {
  s_menu_items[cell_index->row].callback((int)cell_index->row, context);
}

static void prv_push_alarm_screen(int index, void* context) {
  alarm_menu_window_push(false);
}

static void prv_push_timer_screen(int index, void* context) {
  alarm_menu_window_push(true);
}

static void prv_push_legal_screen(int index, void* context) {
  legal_window_push();
}

static void prv_push_reminders_screen(int index, void* context) {
  reminders_menu_push();
}

static void prv_push_about_screen(int index, void* context) {
  about_window_push();
}
