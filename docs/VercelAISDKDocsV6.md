# Vercel AI SDK

The Vercel AI SDK is a comprehensive TypeScript toolkit for building AI-powered applications with language models. It provides a unified interface for interacting with multiple AI providers (OpenAI, Anthropic, Google, and 40+ others) and offers framework-agnostic hooks for React, Vue, Svelte, and Angular. The SDK handles streaming, tool calling, structured output generation, and agentic workflows with built-in support for multi-step reasoning and complex interactions.

The SDK consists of three main layers: the Core AI module (`ai`) for server-side model interactions, framework-specific UI modules (`@ai-sdk/react`, `@ai-sdk/vue`, etc.) for building chat interfaces, and provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.) for model access. It supports both streaming and non-streaming generation, automatic tool execution with approval workflows, structured data extraction using Zod schemas, stateful agent systems that can execute multi-step tasks autonomously, Model Context Protocol (MCP) integration for connecting to external tools and services, and multimedia capabilities including image generation, text-to-speech, audio transcription, and document reranking.

## generateText - Generate text with tool calls

Generate text responses from language models with automatic tool calling and multi-step execution. Returns complete response after all tool calls are executed.

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'What is the weather in San Francisco and what should I wear?',
  tools: {
    getWeather: {
      description: 'Get the weather for a location',
      parameters: z.object({
        city: z.string().describe('The city name')
      }),
      execute: async ({ city }) => {
        // API call to weather service
        return { temperature: 72, condition: 'sunny' };
      }
    }
  },
  maxRetries: 2,
  temperature: 0.7
});

console.log(result.text); // Final text after tool execution
console.log(result.toolCalls); // All tool calls made
console.log(result.usage); // Token usage statistics
console.log(result.steps); // All generation steps
```

## streamText - Stream text with real-time tool execution

Stream text generation with real-time tool calling and event callbacks. Returns stream result with multiple consumption methods.

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const result = streamText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  system: 'You are a helpful assistant with access to real-time data.',
  prompt: 'Search for recent news about AI and summarize the top 3 articles.',
  tools: {
    searchWeb: {
      description: 'Search the web for information',
      parameters: z.object({
        query: z.string()
      }),
      execute: async ({ query }) => {
        // Perform web search
        return { results: ['Article 1...', 'Article 2...', 'Article 3...'] };
      }
    }
  },
  onChunk: async ({ chunk }) => {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text);
    }
  },
  onFinish: async ({ text, toolCalls, usage, steps }) => {
    console.log('\n\nGeneration complete');
    console.log('Total steps:', steps.length);
    console.log('Total tokens:', usage.totalTokens);
  }
});

// Multiple ways to consume the stream
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}

// Or get the full result
const { text, toolResults } = await result;
```

## generateObject - Extract structured data

Generate type-safe structured objects from language models using Zod schemas. Automatically validates and parses model output.

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateObject({
  model: openai('gpt-4-turbo'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({
        name: z.string(),
        amount: z.string(),
        unit: z.string()
      })),
      steps: z.array(z.string()),
      prepTime: z.number().describe('Preparation time in minutes'),
      cookTime: z.number().describe('Cooking time in minutes')
    })
  }),
  prompt: 'Generate a vegetarian lasagna recipe for 4 people.',
  mode: 'json', // 'auto', 'json', or 'tool'
  temperature: 0.3
});

console.log(result.object.recipe.name);
console.log(result.object.recipe.ingredients);
console.log(result.usage);
```

## streamObject - Stream structured data

Stream partial structured objects as they're generated. Enables progressive UI updates while maintaining type safety.

```typescript
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = streamObject({
  model: openai('gpt-4-turbo'),
  schema: z.object({
    characters: z.array(z.object({
      name: z.string(),
      class: z.string(),
      bio: z.string()
    }))
  }),
  prompt: 'Generate 3 fantasy RPG characters with detailed backgrounds.'
});

// Stream partial objects
for await (const partialObject of result.partialObjectStream) {
  console.clear();
  console.log('Current progress:', JSON.stringify(partialObject, null, 2));
}

// Get final validated object
const { object } = await result;
console.log('Final result:', object);
```

## ToolLoopAgent - Autonomous multi-step agents

Create reusable agents that can execute multi-step workflows with tools. ToolLoopAgent automatically handles tool calling loops and can be used across your application.

```typescript
import { ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const researchAgent = new ToolLoopAgent({
  model: openai('gpt-4-turbo'),
  id: 'research-agent',
  instructions: 'You are a research assistant that can search the web and analyze data.',
  tools: {
    searchWeb: {
      description: 'Search the web for information',
      parameters: z.object({
        query: z.string()
      }),
      execute: async ({ query }) => {
        // Perform search
        return { results: ['...'] };
      }
    },
    analyzeData: {
      description: 'Analyze data and provide insights',
      parameters: z.object({
        data: z.array(z.string())
      }),
      execute: async ({ data }) => {
        // Perform analysis
        return { insights: '...' };
      }
    }
  },
  stopWhen: async ({ steps }) => steps.length >= 10 || steps.at(-1)?.finishReason === 'stop',
  maxOutputTokens: 4096
});

// Use the agent (non-streaming)
const result = await researchAgent.generate({
  prompt: 'Research the latest developments in quantum computing and summarize key breakthroughs.'
});

console.log(result.content);
console.log(result.steps.length, 'steps executed');

// Or stream responses
const stream = researchAgent.stream({
  prompt: 'What are the current applications of quantum computing in cryptography?'
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## useChat - React chat interface

React hook for building chat UIs with streaming responses and tool invocations. Manages message state and handles user interactions.

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatComponent() {
  const { messages, status, sendMessage, stop, addToolOutput } = useChat({
    api: '/api/chat',
    initialMessages: [
      { id: '1', role: 'system', content: 'You are a helpful assistant.' }
    ],
    onFinish: (message) => {
      console.log('Message complete:', message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = formData.get('message') as string;

    sendMessage({ text: input });
    e.currentTarget.reset();
  };

  return (
    <div>
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message message-${message.role}`}>
            {message.parts.map((part, i) => {
              switch (part.type) {
                case 'text':
                  return <p key={i}>{part.text}</p>;
                case 'tool-image_generation':
                  if (part.state === 'output-available') {
                    return <img key={i} src={`data:image/png;base64,${part.output.result}`} />;
                  }
                  return <p key={i}>Generating image...</p>;
                default:
                  return null;
              }
            })}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          name="message"
          placeholder="Type a message..."
          disabled={status !== 'ready'}
        />
        <button type="submit" disabled={status !== 'ready'}>
          Send
        </button>
        {status === 'in-progress' && (
          <button type="button" onClick={stop}>Stop</button>
        )}
      </form>
    </div>
  );
}
```

## Chat API Route - Next.js App Router

Server-side chat endpoint that streams responses to the client. Uses agents with tool calling for complex interactions.

```typescript
// app/api/chat/route.ts
import { ToolLoopAgent, createAgentUIStreamResponse } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const chatAgent = new ToolLoopAgent({
  model: openai('gpt-4-turbo'),
  instructions: 'You are a helpful assistant that can search the web and perform calculations.',
  tools: {
    search: {
      description: 'Search for information',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        // Implement search
        return { results: ['...'] };
      }
    },
    calculate: {
      description: 'Perform a calculation',
      parameters: z.object({ expression: z.string() }),
      execute: async ({ expression }) => {
        // Implement calculator
        return { result: eval(expression) };
      }
    }
  }
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: chatAgent,
    messages,
  });
}
```

## Tool Approval Workflow - User-controlled tool execution

Implement approval flows for sensitive tool operations. User can approve or deny each tool call before execution.

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = streamText({
  model: openai('gpt-4-turbo'),
  prompt: 'Delete the file named old-data.txt',
  tools: {
    deleteFile: {
      description: 'Delete a file from the filesystem',
      parameters: z.object({
        filename: z.string()
      }),
      requiresApproval: async ({ input }) => {
        // Require approval for deletions
        return true;
      },
      execute: async ({ filename }) => {
        // Delete file
        return { success: true };
      }
    }
  }
});

// Handle tool approval requests
for await (const chunk of result.fullStream) {
  if (chunk.type === 'tool-approval-request') {
    const userApproved = await askUser(
      `Approve deletion of ${chunk.toolCall.input.filename}?`
    );

    if (userApproved) {
      await result.addToolApprovalResponse({
        approvalId: chunk.approvalId,
        approved: true
      });
    } else {
      await result.addToolApprovalResponse({
        approvalId: chunk.approvalId,
        approved: false,
        reason: 'User denied permission'
      });
    }
  }
}
```

## MCP Integration - Model Context Protocol

Connect to MCP servers to access external tools and services. The MCP client is available in the dedicated `@ai-sdk/mcp` package and supports stdio, HTTP, and SSE transports with OAuth authentication.

```typescript
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Create MCP client with stdio transport
const mcpClient = createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  }),
  capabilities: {
    tools: true,
    prompts: true,
  }
});

// Get tools from MCP server
const tools = await mcpClient.getTools();

// Use MCP tools with generateText
const result = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'List files in the current directory',
  tools: tools,
});

console.log(result.text);

// Clean up
await mcpClient.close();
```

## embed - Generate text embeddings

Generate vector embeddings for text using various embedding models. Useful for semantic search and similarity matching.

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'The quick brown fox jumps over the lazy dog.',
  dimensions: 512 // Optional: reduce dimensionality
});

console.log(result.embedding); // Float array of embedding values
console.log(result.usage); // Token usage
```

## embedMany - Batch embedding generation

Generate embeddings for multiple texts efficiently with automatic batching and retry handling.

```typescript
import { embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';

const texts = [
  'Artificial intelligence is transforming technology.',
  'Machine learning models require large datasets.',
  'Natural language processing enables human-computer interaction.'
];

const result = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: texts,
  maxRetries: 2
});

console.log(result.embeddings); // Array of embedding arrays
console.log(result.usage); // Total token usage

// Calculate cosine similarity between embeddings
const similarity = cosineSimilarity(result.embeddings[0], result.embeddings[1]);
console.log('Similarity:', similarity);
```

## generateImage - Generate images from text

Generate images using image generation models like DALL-E, Stable Diffusion, and others. Supports multiple providers and advanced configuration.

```typescript
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateImage({
  model: openai.image('dall-e-3'),
  prompt: 'A serene mountain landscape at sunset with a lake in the foreground',
  n: 1, // Number of images
  size: '1024x1024',
  aspectRatio: '16:9', // Alternative to size
  seed: 12345, // For reproducibility
  providerOptions: {
    openai: {
      style: 'vivid',
      quality: 'hd'
    }
  }
});

console.log(result.images); // Array of generated images
console.log(result.images[0].base64); // Base64-encoded image data
console.log(result.images[0].uint8Array); // Raw image bytes

// Save image to file
import fs from 'fs';
fs.writeFileSync('output.png', result.images[0].uint8Array);
```

## generateSpeech - Convert text to speech

Generate speech audio from text using text-to-speech models. Supports multiple voices, languages, and audio formats.

```typescript
import { generateSpeech } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateSpeech({
  model: openai.speech('tts-1'),
  text: 'Hello, welcome to the AI SDK. This is a demonstration of text-to-speech capabilities.',
  voice: 'alloy', // Voice selection
  outputFormat: 'mp3', // 'mp3' | 'wav' | 'opus' | 'aac' | 'flac'
  speed: 1.0, // Speech speed (0.25 to 4.0)
  language: 'en', // ISO 639-1 language code
  instructions: 'Speak in a friendly and enthusiastic tone'
});

console.log(result.audio); // Audio file object
console.log(result.audio.uint8Array); // Raw audio bytes
console.log(result.warnings); // Any warnings from generation

// Save audio to file
import fs from 'fs';
fs.writeFileSync('output.mp3', result.audio.uint8Array);
```

## experimental_transcribe - Transcribe audio to text

Transcribe audio files to text using speech recognition models like Whisper. Supports various audio formats and returns detailed transcription data.

```typescript
import { experimental_transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs';

// Transcribe from file
const audioData = fs.readFileSync('recording.mp3');

const result = await experimental_transcribe({
  model: openai.transcription('whisper-1'),
  audio: audioData,
  language: 'en', // Optional: specify source language
  prompt: 'This is a technical discussion about AI.' // Optional: context hint
});

console.log(result.text); // Full transcription
console.log(result.segments); // Timestamped segments
console.log(result.language); // Detected language
console.log(result.duration); // Audio duration in seconds

// Access timestamped segments
result.segments?.forEach(segment => {
  console.log(`[${segment.start}s - ${segment.end}s]: ${segment.text}`);
});
```

## rerank - Rerank documents by relevance

Rerank a list of documents based on their relevance to a query using specialized reranking models. More accurate than simple embedding similarity for search and retrieval.

```typescript
import { rerank } from 'ai';
import { cohere } from '@ai-sdk/cohere';

const documents = [
  { id: '1', text: 'Machine learning is a subset of artificial intelligence.' },
  { id: '2', text: 'Paris is the capital city of France.' },
  { id: '3', text: 'Neural networks are inspired by the human brain.' },
  { id: '4', text: 'The Eiffel Tower is located in Paris.' },
  { id: '5', text: 'Deep learning uses multiple layers of neural networks.' }
];

const result = await rerank({
  model: cohere.reranker('rerank-english-v3.0'),
  query: 'What is artificial intelligence and machine learning?',
  documents: documents.map(doc => doc.text),
  topN: 3 // Return top 3 most relevant documents
});

console.log(result.ranking); // Ranked results with relevance scores
result.ranking.forEach(ranked => {
  console.log(`Original Index ${ranked.originalIndex}: Score ${ranked.score}`);
  console.log(`Document: ${ranked.document}\n`);
});

// Access reranked documents directly
console.log(result.rerankedDocuments);
```

## Provider Configuration - Multiple AI providers

Configure and use multiple AI providers in the same application. The SDK provides unified interfaces across all providers.

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai-compatible';

// OpenAI
const openaiResult = await generateText({
  model: openai('gpt-4-turbo', {
    apiKey: process.env.OPENAI_API_KEY
  }),
  prompt: 'Explain quantum computing.'
});

// Anthropic
const anthropicResult = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022', {
    apiKey: process.env.ANTHROPIC_API_KEY
  }),
  prompt: 'Explain quantum computing.'
});

// Google Gemini
const googleResult = await generateText({
  model: google('gemini-1.5-pro', {
    apiKey: process.env.GOOGLE_API_KEY
  }),
  prompt: 'Explain quantum computing.'
});

// OpenAI-compatible providers (Groq, Together, etc.)
const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

const groqResult = await generateText({
  model: groq('llama-3.1-70b-versatile'),
  prompt: 'Explain quantum computing.'
});

// Or use Vercel AI Gateway for unified access
const gatewayResult = await generateText({
  model: 'openai/gpt-4-turbo', // Gateway handles routing
  prompt: 'Explain quantum computing.'
});
```

## Multi-step Reasoning with Callbacks

Track and control multi-step generation processes with detailed callbacks for each step. Useful for debugging and monitoring agent behavior.

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'Research the history of the internet and create a timeline.',
  tools: {
    search: {
      description: 'Search for information',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: ['...'] })
    }
  },
  stopWhen: ({ steps }) => steps.length >= 5,
  onStepFinish: async (stepResult) => {
    console.log(`\n--- Step ${stepResult.response.messages.length} ---`);
    console.log('Finish reason:', stepResult.finishReason);
    console.log('Tool calls:', stepResult.toolCalls?.length || 0);
    console.log('Tokens used:', stepResult.usage.totalTokens);

    if (stepResult.toolCalls) {
      stepResult.toolCalls.forEach(call => {
        console.log(`Tool: ${call.toolName}`, call.input);
      });
    }
  },
  onFinish: async ({ steps, totalUsage, text }) => {
    console.log('\n=== Generation Complete ===');
    console.log('Total steps:', steps.length);
    console.log('Total tokens:', totalUsage.totalTokens);
    console.log('Final output length:', text.length);
  }
});

console.log('\nFinal result:', result.text);
```

## Structured Output with Output Helpers

Generate structured outputs with helper functions for arrays, choices, and unstructured JSON. Simplifies schema definition and provides better type safety.

```typescript
import { generateText, Output, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Generate an array of objects
const arrayResult = await generateText({
  model: openai('gpt-4o-mini'),
  output: Output.array({
    element: z.object({
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['admin', 'user', 'guest'])
    })
  }),
  stopWhen: stepCountIs(5),
  prompt: 'Generate 5 sample user profiles.'
});

console.log(arrayResult.output); // Array of user objects

// Generate an enum/choice
const choiceResult = await generateText({
  model: openai('gpt-4o-mini'),
  output: Output.choice({
    options: ['positive', 'negative', 'neutral']
  }),
  prompt: 'Analyze the sentiment of: "This product is amazing!"'
});

console.log(choiceResult.output); // 'positive' | 'negative' | 'neutral'

// Generate unstructured JSON (no schema required)
const jsonResult = await generateText({
  model: openai('gpt-4o-mini'),
  output: Output.json(),
  system: 'Return JSON only, no other text.',
  prompt: 'Generate a flexible JSON object with user data and metadata.'
});

console.log(jsonResult.output); // Any JSON value

// Or use Output.object() with generateText for type-safe objects
const objectResult = await generateText({
  model: openai('gpt-4o-mini'),
  output: Output.object({
    schema: z.object({
      users: z.array(z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0).max(120)
      }))
    })
  }),
  prompt: 'Generate 3 user profiles.'
});

console.log(objectResult.output.users);
```

## The Vercel AI SDK provides comprehensive tools for building production-ready AI applications with type safety, streaming support, and multi-provider compatibility. The core `generateText` and `streamText` functions handle text generation with automatic tool calling and multi-step reasoning, enabling complex agentic workflows. For structured data extraction, `generateObject` and `streamObject` parse LLM outputs into type-safe objects using Zod schemas with validation, while `generateText` can also produce structured outputs using the `output` parameter with helpers like `Output.object()`, `Output.array()`, `Output.choice()`, and `Output.json()`. The `ToolLoopAgent` class encapsulates reusable AI behaviors with tools and instructions, making it easy to create specialized assistants that can execute multi-step workflows autonomously and be integrated into chat interfaces via `createAgentUIStreamResponse`.

Framework integration is seamless through UI hooks like `useChat` for React from `@ai-sdk/react`, plus similar hooks for `@ai-sdk/vue` and `@ai-sdk/svelte` that manage message state with parts-based message structure, handle streaming, and provide loading indicators. The SDK supports 40+ AI providers through a unified interface, including OpenAI, Anthropic, Google, Azure, AWS Bedrock, xAI, Deepgram, AssemblyAI, ElevenLabs, and open-source models via OpenAI-compatible endpoints. Advanced features include Model Context Protocol (MCP) integration via `@ai-sdk/mcp` for connecting to external tool servers with stdio, HTTP, and SSE transports plus OAuth support, tool approval workflows with `requiresApproval` for sensitive operations, embedding generation for semantic search with `embed` and `embedMany` plus `cosineSimilarity` for similarity calculations, document reranking with the `rerank` function for improved search relevance, and multimedia capabilities with `generateImage` for DALL-E and Stable Diffusion models, `generateSpeech` for text-to-speech audio generation with providers like OpenAI and Deepgram, and `transcribe` for audio-to-text conversion with timestamped segments. The SDK offers reasoning output tracking for advanced models, `stopWhen` conditions for controlling multi-step execution, `onStepFinish` callbacks for monitoring agent progress, custom retry logic with exponential backoff, telemetry integration with OpenTelemetry, and comprehensive error handling with typed exceptions. Every function returns detailed usage statistics including token counts, finish reasons, and provider metadata for observability and cost tracking.
