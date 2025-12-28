---
name: AI SDK 5 Migration
overview: Migrate the zen-chat project from AI SDK v4.3.19 to v5.0, following the phased approach in AI_SDK_5_MIGRATION.md. The codebase already uses parts arrays for messages, but requires updates to experimental APIs, tool invocation structures, streaming protocols, and message conversion layers.
todos:
  - id: phase1-prep
    content: "Phase 1: Preparation - Create git branch, review codebase, identify message.content usage"
    status: pending
  - id: phase2-deps
    content: "Phase 2: Update dependencies - Upgrade ai@5, providers, add ai-legacy alias"
    status: pending
    dependencies:
      - phase1-prep
  - id: phase3-codemods
    content: "Phase 3: Run automated codemods and identify FIXME comments"
    status: pending
    dependencies:
      - phase2-deps
  - id: phase4-foundation
    content: "Phase 4: Critical foundation - Update UIMessage types, migrate message.content to parts, update tool structures"
    status: pending
    dependencies:
      - phase3-codemods
  - id: phase5-conversion
    content: "Phase 5: Data migration - Add bidirectional conversion functions, apply when reading/writing messages"
    status: pending
    dependencies:
      - phase4-foundation
  - id: phase6-manual
    content: "Phase 6: Manual changes - Update experimental APIs, streaming protocol, reasoning fields, useChat transport"
    status: pending
    dependencies:
      - phase5-conversion
  - id: phase7-testing
    content: "Phase 7: Testing - Type check, build, test with historical data and new conversations"
    status: pending
    dependencies:
      - phase6-manual
---

# AI SDK 5 Migration Plan

## Overview

This project is currently on AI SDK v4.3.19 and needs to migrate to v5.0. The codebase has good foundations (already using `parts` arrays), but requires significant updates to experimental APIs, tool structures, streaming, and message conversion.

## Key Areas for Migration

### 1. Dependencies & Setup

- Current version: `ai@^4.3.19` in [package.json](package.json)
- Update to `ai@^5.0.0` and all `@ai-sdk/*` packages
- Add `ai-legacy` alias for message conversion functions

### 2. React Hook Changes (`useChat`)

**Files:**

- [src/hooks/use-chat-integration.ts](src/hooks/use-chat-integration.ts) - Main integration using `useChat`
- [src/hooks/use-chat-actions.ts](src/hooks/use-chat-actions.ts) - Actions that depend on useChat

**Changes needed:**

- Replace `experimental_prepareRequestBody` → `prepareSendMessagesRequest` in transport config
- Replace `experimental_resume` → use new resume mechanism
- Replace `experimental_throttle` → remove (handled by transport)
- Wrap with `DefaultChatTransport` from `ai` package
- Update method names: `append` → `sendMessage`, `reload` → `regenerate`

### 3. Message Conversion Layer

**Files:**

- [convex/lib/backend_to_ui_messages.ts](convex/lib/backend_to_ui_messages.ts) - Converts DB messages to UI format (uses `message.content` fallback)
- [convex/lib/db_to_core_messages.ts](convex/lib/db_to_core_messages.ts) - Converts DB messages to Core format for streaming
- [convex/schema/parts.ts](convex/schema/parts.ts) - Message part schema definitions

**Changes needed:**

- Add bidirectional conversion functions (`convertV4MessageToV5`, `convertV5MessageToV4`)
- Apply conversion when loading from database
- Apply conversion when saving to database
- Update `backendToUiMessages` to remove `message.content` fallback (line 22)
- Update tool invocation structure handling

### 4. Tool Invocation Structure

**Files:**

- [convex/schema/parts.ts](convex/schema/parts.ts) - ToolInvocationUIPart schema (lines 45-55)
- [convex/lib/db_to_core_messages.ts](convex/lib/db_to_core_messages.ts) - Tool invocation mapping (lines 181-194)
- [convex/chat_http/manual_stream_transform.ts](convex/chat_http/manual_stream_transform.ts) - Tool streaming handling (lines 180-212)
- [src/components/renderers/generic-tool.tsx](src/components/renderers/generic-tool.tsx) - Tool rendering
- [src/components/renderers/web-search-ui.tsx](src/components/renderers/web-search-ui.tsx) - Tool rendering
- [src/components/renderers/image-generation-ui.tsx](src/components/renderers/image-generation-ui.tsx) - Tool rendering

**Changes needed:**

- `type: "tool-invocation"` → `type: "tool-{toolName}"`
- Nested `toolInvocation` object → Flat structure
- State names: `"partial-call"` → `"input-streaming"`, `"call"` → `"input-available"`, `"result"` → `"output-available"`
- Field names: `args` → `input`, `result` → `output`
- Add error state: `"output-error"`

### 5. Streaming Changes

**Files:**

- [convex/chat_http/post.route.ts](convex/chat_http/post.route.ts) - Main streaming endpoint (uses `createDataStream`, `streamText`)
- [convex/chat_http/manual_stream_transform.ts](convex/chat_http/manual_stream_transform.ts) - Custom stream transformation
- [convex/chat_http/get.route.ts](convex/chat_http/get.route.ts) - Stream resumption

**Changes needed:**

- Update stream protocol: `text-delta` → `delta`, new start/end patterns
- Update events: `step-finish` → `finish-step`
- Update reasoning: `reasoning` → `reasoningText`
- Update provider metadata: `providerMetadata` → `providerOptions`
- Remove `toolCallStreaming` (now default)

### 6. Experimental API Updates

**Files:**

- [convex/lib/tools/mcp_adapter.ts](convex/lib/tools/mcp_adapter.ts) - Uses `experimental_createMCPClient` (line 2)
- [convex/chat_http/image_generation.ts](convex/chat_http/image_generation.ts) - Uses `experimental_generateImage` (line 2)

**Changes needed:**

- Replace `experimental_createMCPClient` → `createMCPClient`
- Replace `experimental_generateImage` → `generateImage`

### 7. Message Content Access

**Files:**

- [convex/chat_http/generate_thread_name.ts](convex/chat_http/generate_thread_name.ts) - Uses `message.content` (line 92)

**Changes needed:**

- Update `contentToText` function to read from `parts` array instead of `content`

### 8. Reasoning Field Updates

**Files:**

- [convex/schema/parts.ts](convex/schema/parts.ts) - ReasoningPart schema (lines 14-29)
- [convex/chat_http/manual_stream_transform.ts](convex/chat_http/manual_stream_transform.ts) - Reasoning handling (lines 78-91)

**Changes needed:**

- Update reasoning field: `reasoning` → `text` in parts

## Migration Phases

The migration follows the checklist in [AI_SDK_5_MIGRATION.md](AI_SDK_5_MIGRATION.md):

1. **Phase 1**: Preparation (git branch, codebase review)
2. **Phase 2**: Update dependencies (ai@5, providers, ai-legacy alias)
3. **Phase 3**: Run automated codemods
4. **Phase 4**: Critical foundation changes (UIMessage types, message.content migration, tool structures)
5. **Phase 5**: Data migration (bidirectional conversion layer)
6. **Phase 6**: Remaining manual changes (experimental APIs, streaming, reasoning)
7. **Phase 7**: Final testing (build, type check, historical data)
8. **Phase 8**: Optional database schema migration (manual, requires human)
9. **Phase 9**: Documentation & cleanup

## Important Notes

- The codebase already uses `parts` arrays in the database schema, which is good
- Message conversion functions need to handle v4 → v5 transformation
- Tool invocation structure changes are significant and affect multiple files
- Streaming protocol changes require updates to manual transforms
- All `experimental_` APIs need to be updated to stable equivalents

## Testing Strategy