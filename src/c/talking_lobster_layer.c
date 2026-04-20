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

#include "talking_lobster_layer.h"
#include "util/perimeter.h"
#include <pebble.h>

#include "util/memory/sdk.h"

typedef struct {
  GPerimeter perimeter;
  Layer *layer;
  const char* text;
  GDrawCommandImage* lobster;
  GSize text_size;
  GTextAttributes *text_attributes;
} TalkingLobsterLayerData;

static void prv_update_layer(Layer *layer, GContext *ctx);
static GTextAttributes *prv_create_text_attributes(TalkingLobsterLayer *layer);
static GRangeHorizontal prv_perimeter_callback(const GPerimeter *perimeter, const GSize *ctx_size, GRangeVertical vertical_range, uint16_t inset);


TalkingLobsterLayer *talking_lobster_layer_create(GRect frame) {
  Layer *layer = blayer_create_with_data(frame, sizeof(TalkingLobsterLayerData));
  TalkingLobsterLayerData *data = layer_get_data(layer);
  data->perimeter = (GPerimeter) { .callback = prv_perimeter_callback };
  data->layer = layer;
  data->text = NULL;
  data->text_size = GSizeZero;
  data->lobster = bgdraw_command_image_create_with_resource(RESOURCE_ID_ROOT_SCREEN_LOBSTER);
  data->text_attributes = prv_create_text_attributes(layer);
  layer_set_update_proc(layer, prv_update_layer);
  return layer;
}

void talking_lobster_layer_destroy(TalkingLobsterLayer *layer) {
  TalkingLobsterLayerData *data = layer_get_data(layer);
  gdraw_command_image_destroy(data->lobster);
  graphics_text_attributes_destroy(data->text_attributes);
  layer_destroy(layer);
}

void talking_lobster_layer_set_text(TalkingLobsterLayer *layer, const char *text) {
  TalkingLobsterLayerData *data = layer_get_data(layer);
  data->text = text;
  GRect bounds = layer_get_bounds(layer);
  data->text_size = graphics_text_layout_get_content_size_with_attributes(text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD), GRect(0, 1, bounds.size.w - 23, bounds.size.h - 15), GTextOverflowModeWordWrap, GTextAlignmentLeft, data->text_attributes);
  layer_mark_dirty(layer);
}

static void prv_update_layer(Layer *layer, GContext *ctx) {
  TalkingLobsterLayerData *data = layer_get_data(layer);
  GRect bounds = layer_get_bounds(layer);
  GSize size = bounds.size;

  const int text_height = data->text_size.h + 5;
  const int available_space = bounds.size.w - 18 - data->text_size.w - 10;
  const int bubble_width = size.w - 16 - available_space;
  const int corner_offset = 6;
#ifdef PBL_ROUND
  const int bubble_x = (size.w - bubble_width) / 2 - ACTION_BAR_WIDTH / 2;
#else
  const int bubble_x = 8 + available_space;
#endif

  // Lobster position
#ifdef PBL_PLATFORM_EMERY
  const int lobster_height = 177;
  const int lobster_width = 171;
  const int lobster_x = 0;
  const int lobster_y = size.h - lobster_height;
#elif defined(PBL_PLATFORM_CHALK)
  const int lobster_height = 118;
  const int lobster_width = 114;
  const int lobster_x = (size.w - lobster_width) / 2;
  const int lobster_y = size.h - lobster_height;
#elif defined(PBL_ROUND)
  const int lobster_height = 118;
  const int lobster_width = 114;
  const int lobster_x = (size.w - lobster_width) / 2;
  const int lobster_y = size.h - lobster_height + 30;
#else
  const int lobster_height = 118;
  const int lobster_width = 114;
  const int lobster_x = 0;
  const int lobster_y = size.h - lobster_height;
#endif

  // Position bubble just above the lobster on all platforms
  const int bubble_overlap = 2;
  const int speech_bubble_top = lobster_y - text_height + bubble_overlap;

  GPath bubble_path = {
    .num_points = 8,
    .offset = GPoint(bubble_x, speech_bubble_top),
    .rotation = 0,
    .points = (GPoint[]) {
      // top left rounded
      {0, corner_offset},
      {corner_offset, 0},
      // top right rounded
      {bubble_width - corner_offset, 0},
      {bubble_width, corner_offset},
      // bottom right rounded
      {bubble_width, text_height},
      {bubble_width - corner_offset, text_height + corner_offset},
      // bottom left rounded
      {corner_offset, text_height + corner_offset},
      {0, text_height},
    }
  };
  graphics_context_set_fill_color(ctx, GColorWhite);
  gpath_draw_filled(ctx, &bubble_path);
  graphics_context_set_stroke_color(ctx, GColorBlack);
  graphics_context_set_stroke_width(ctx, 3);
  gpath_draw_outline(ctx, &bubble_path);

  graphics_context_set_text_color(ctx, GColorBlack);
  GRect text_bounds = GRect(bubble_x + corner_offset + 2, speech_bubble_top + corner_offset - 5, data->text_size.w, data->text_size.h);
  graphics_draw_text(ctx, data->text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD), text_bounds, GTextOverflowModeWordWrap, GTextAlignmentLeft, data->text_attributes);
  gdraw_command_image_draw(ctx, data->lobster, GPoint(lobster_x, lobster_y));
}

static GTextAttributes* prv_create_text_attributes(TalkingLobsterLayer *layer) {
  TalkingLobsterLayerData *data = layer_get_data(layer);
  GTextAttributes *attributes = graphics_text_attributes_create();
  attributes->flow_data.perimeter.impl = &data->perimeter;
  attributes->flow_data.perimeter.inset = 0;
  return attributes;
}


static GRangeHorizontal prv_perimeter_callback(const GPerimeter *perimeter, const GSize *ctx_size, GRangeVertical vertical_range, uint16_t inset) {
  // We don't get a reference to the original layer, but we do get this perimeter pointer. By putting the perimeter at
  // the top of the struct, we can make this cast and get away with it.
  TalkingLobsterLayerData *data = (TalkingLobsterLayerData*)perimeter;
  Layer *layer = data->layer;
  GRect bounds = layer_get_bounds(layer);
  // the lobster is drawn at the bottom-left of the layer
#ifdef PBL_PLATFORM_EMERY
  const int16_t lobster_size = 177;
  const int16_t lobster_y_offset = 0;
  const int16_t lobster_x = 0;
#elif defined(PBL_PLATFORM_CHALK)
  const int16_t lobster_size = 118;
  const int16_t lobster_y_offset = 0;
  const int16_t lobster_x = (bounds.size.w - lobster_size) / 2;
#elif defined(PBL_ROUND)
  const int16_t lobster_size = 118;
  const int16_t lobster_y_offset = 30;
  const int16_t lobster_x = (bounds.size.w - lobster_size) / 2;
#else
  const int16_t lobster_size = 118;
  const int16_t lobster_y_offset = 0;
  const int16_t lobster_x = 0;
#endif
  GPoint wrap_point = layer_convert_point_to_screen(layer, GPoint(lobster_x + lobster_size, bounds.size.h - lobster_size + lobster_y_offset));
  // We know the lobster is at the bottom of our layer, so we don't bother worrying about text being rendered past it.
  if (vertical_range.origin_y + vertical_range.size_h < wrap_point.y) {
    // nothing to do here - implement the inset while we're here, though.
    return (GRangeHorizontal) { .origin_x = inset, .size_w = ctx_size->w - inset * 2 };
  } else {
    // The lobster is in the way, so we need to indent the text on the left.
    return (GRangeHorizontal) { .origin_x = wrap_point.x + inset, .size_w = ctx_size->w - wrap_point.x - inset * 2 };
  }
}