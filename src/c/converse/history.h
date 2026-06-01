#ifndef HISTORY_H
#define HISTORY_H

#include <pebble.h>

#define HISTORY_MAX_ENTRIES 8

typedef enum {
  HistoryEntryTypePrompt,
  HistoryEntryTypeResponse,
} HistoryEntryType;

typedef struct {
  HistoryEntryType type;
  char text[256];
} HistoryEntry;

void history_init(void);
void history_add_prompt(const char* text);
void history_add_response(const char* text);
void history_set_thread_id(const char* thread_id);
void history_set_done(void);
void history_push_prompt(const char* text);
void history_push_response(const char* text);
void history_push_thread_id(const char* thread_id);
bool history_is_available(void);
const char* history_get_thread_id(void);
int history_get_count(void);
const HistoryEntry* history_get_entry(int index);
void history_free(void);

#endif