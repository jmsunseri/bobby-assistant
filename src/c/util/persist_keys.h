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

#ifndef APP_PERSIST_KEYS_H
#define APP_PERSIST_KEYS_H

// These keys are stored centrally so we can avoid accidental collisions.
// Remember: these numbers can *never* be changed.

// next key: 14

// Store whether we have successfully requested location consent.
#define PERSIST_KEY_LOCATION_ENABLED 6

// Store whether the user has accepted the consents
#define PERSIST_KEY_CONSENTS_COMPLETED 12

// Contains the version we were running the last time we were launched
#define PERSIST_KEY_VERSION 7

// Persist keys for our settings
#define PERSIST_KEY_QUICK_LAUNCH_BEHAVIOUR 9
#define PERSIST_KEY_CONFIRM_TRANSCRIPTS 13

// Store whether Telegram is connected
#define PERSIST_KEY_TELEGRAM_CONNECTED 14

#endif //APP_PERSIST_KEYS_H
