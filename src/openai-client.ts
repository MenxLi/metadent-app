import OpenAI from 'openai'

export type AIChatRole = 'system' | 'user' | 'assistant'

export interface AIChatImageInput {
  imageUrl: string;
}

export interface AIChatMessage {
  role: Exclude<AIChatRole, 'system'>;
  content: string;
  images?: AIChatImageInput[];
}

export interface AIChatAgent {
  name?: string;
  instructions?: string;
}

export interface AIChatRequest {
  message: string;
  conversation?: AIChatMessage[];
  systemPrompt?: string;
  agent?: AIChatAgent;
  images?: AIChatImageInput[];
}

interface OpenAIChatClientOptions {
  apiKey: string;
  baseURL: string;
  model: string;
}

type OpenAITextPart = { type: 'text'; text: string }
type OpenAIImagePart = { type: 'image_url'; image_url: { url: string } }

export class OpenAIChatClient {
  private readonly client: OpenAI
  private readonly model: string

  constructor(options: OpenAIChatClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      dangerouslyAllowBrowser: true,
    })
    this.model = options.model
  }

  private buildUserContent(message: string, images?: AIChatImageInput[]) {
    const content: Array<OpenAITextPart | OpenAIImagePart> = [{ type: 'text', text: message }]

    if (!images?.length) {
      return content
    }

    const seenImageUrls = new Set<string>()
    for (const { imageUrl } of images) {
      if (seenImageUrls.has(imageUrl)) {
        continue
      }

      seenImageUrls.add(imageUrl)
      content.push({
        type: 'image_url',
        image_url: { url: imageUrl },
      })
    }

    return content
  }

  private buildSystemPrompt(request: AIChatRequest): string {
    const promptParts = [
      request.systemPrompt ?? 'You are assisting with dental image labeling. Be precise, concise, and only answer from the visible image and provided labeling context. If the image does not support a claim, say so.',
      request.agent?.name ? `Agent: ${request.agent.name}` : '',
      request.agent?.instructions ? `Agent instructions: ${request.agent.instructions}` : '',
    ].filter(Boolean)

    return promptParts.join('\n')
  }

  private getMessageText(content: string | null | Array<{ type?: string; text?: string }>): string {
    if (typeof content === 'string') {
      return content
    }

    if (!Array.isArray(content)) {
      return ''
    }

    return content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('\n')
  }

  async complete(request: AIChatRequest): Promise<string> {
    const historyMessages = (request.conversation ?? []).map((message) => message.role === 'assistant'
        ? {
          role: 'assistant' as const,
          content: message.content,
        }
        : {
          role: 'user' as const,
          content: this.buildUserContent(message.content, message.images),
        })

    const currentMessage = {
      role: 'user' as const,
      content: this.buildUserContent(request.message, request.images),
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(request),
        },
        ...historyMessages,
        currentMessage,
      ],
    })

    return this.getMessageText(completion.choices[0]?.message?.content ?? null)
  }
}
