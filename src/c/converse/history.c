#include "history.h"
#include "../util/memory/malloc.h"
#include "../util/logging.h"
#include <string.h>

static HistoryEntry s_entries[HISTORY_MAX_ENTRIES];
static int s_count = 0;
static char s_thread_id[37] = "";
static bool s_done = false;

void history_init(void) {
  s_count = 0;
  s_done = false;
  s_thread_id[0] = '\0';
}

void history_add_prompt(const char* text) {
  if (s_count >= HISTORY_MAX_ENTRIES) return;
  s_entries[s_count].type = HistoryEntryTypePrompt;
  strncpy(s_entries[s_count].text, text, sizeof(s_entries[s_count].text) - 1);
  s_entries[s_count].text[sizeof(s_entries[s_count].text) - 1] = '\0';
  s_count++;
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History prompt %d: %.50s", s_count, text);
}

void history_add_response(const char* text) {
  if (s_count >= HISTORY_MAX_ENTRIES) return;
  s_entries[s_count].type = HistoryEntryTypeResponse;
  strncpy(s_entries[s_count].text, text, sizeof(s_entries[s_count].text) - 1);
  s_entries[s_count].text[sizeof(s_entries[s_count].text) - 1] = '\0';
  s_count++;
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History response %d: %.50s", s_count, text);
}

void history_set_thread_id(const char* thread_id) {
  strncpy(s_thread_id, thread_id, sizeof(s_thread_id) - 1);
  s_thread_id[sizeof(s_thread_id) - 1] = '\0';
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History thread ID: %s", thread_id);
}

static void prv_shift_if_full(void) {
  if (s_count <= HISTORY_MAX_ENTRIES) return;
  int shift = s_count - HISTORY_MAX_ENTRIES;
  for (int i = 0; i < HISTORY_MAX_ENTRIES; i++) {
    if (i + shift < s_count) {
      s_entries[i] = s_entries[i + shift];
    }
  }
  s_count = HISTORY_MAX_ENTRIES;
}

void history_push_prompt(const char* text) {
  prv_shift_if_full();
  s_entries[s_count].type = HistoryEntryTypePrompt;
  strncpy(s_entries[s_count].text, text, sizeof(s_entries[s_count].text) - 1);
  s_entries[s_count].text[sizeof(s_entries[s_count].text) - 1] = '\0';
  s_count++;
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History push prompt %d: %.50s", s_count, text);
}

void history_push_response(const char* text) {
  prv_shift_if_full();
  s_entries[s_count].type = HistoryEntryTypeResponse;
  strncpy(s_entries[s_count].text, text, sizeof(s_entries[s_count].text) - 1);
  s_entries[s_count].text[sizeof(s_entries[s_count].text) - 1] = '\0';
  s_count++;
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History push response %d: %.50s", s_count, text);
}

void history_push_thread_id(const char* thread_id) {
  history_set_thread_id(thread_id);
}

void history_set_done(void) {
  s_done = true;
  CLAWD_LOG(APP_LOG_LEVEL_INFO, "History done. %d entries.", s_count);
}

bool history_is_available(void) {
  return s_done && s_count > 0;
}

const char* history_get_thread_id(void) {
  return s_thread_id;
}

int history_get_count(void) {
  return s_count;
}

const HistoryEntry* history_get_entry(int index) {
  if (index < 0 || index >= s_count) return NULL;
  return &s_entries[index];
}

void history_free(void) {
  s_count = 0;
  s_done = false;
  s_thread_id[0] = '\0';
}