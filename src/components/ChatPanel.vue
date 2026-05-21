<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { AIService } from '@/api'
import type { AIChatMessage } from '@/openai-client'
import ChatPanelQueries from '@/components/ChatPanelQueries.vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'

const INITIAL_ASSISTANT_MESSAGE = 'Ask about the current image. I will answer using the visible content.'

const dataStore = useDataStore()
const userStore = useUserStore()
const aiService = new AIService()
let modelRequestId = 0

const isLoadingModels = ref(false)
const messageList = ref<HTMLDivElement | null>(null)
const availableModels = ref<string[]>([])

interface ChatConversationState {
	draft: string
	isSubmitting: boolean
	messages: AIChatMessage[]
	editingIndex: number | null
	editingDraft: string
}

const conversationStates = reactive<Record<string, ChatConversationState>>({})

const hasActiveImage = computed(() => Boolean(dataStore.activeDataItem?.imageUrl))
const hasAIConfig = computed(() => {
	const settings = userStore.settings
	return settings.enableAIAutoGen && settings.aiFeatureSet.showChatPanel && Boolean(settings.aiBackendUrl?.trim()) && Boolean(settings.aiBackendToken?.trim())
})
const canChat = computed(() => hasAIConfig.value && Boolean(userStore.settings.aiModelName))
const activeFileName = computed(() => dataStore.activeDataItem?.fileName ?? '')
const activeConversation = computed(() => conversationStates[activeFileName.value] ?? null)
const predefinedQueries = computed({
	get: () => userStore.settings.aiChatPredefinedQueries,
	set: (queries: string[]) => {
		userStore.updateAiChatPredefinedQueries(queries)
	},
})

function createConversationState(): ChatConversationState {
	return {
		draft: '',
		isSubmitting: false,
		messages: [{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }],
		editingIndex: null,
		editingDraft: '',
	}
}

function resetConversation() {
	const fileName = activeFileName.value
	if (!fileName) {
		return
	}

	conversationStates[fileName] = createConversationState()
}

watch(activeFileName, (fileName) => {
	if (!fileName || conversationStates[fileName]) {
		return
	}

	conversationStates[fileName] = createConversationState()
}, { immediate: true })

watch(() => [activeFileName.value, activeConversation.value?.messages.length ?? 0] as const, () => {
	nextTick(() => {
		messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
	})
})

watch(
	() => [
		userStore.settings.enableAIAutoGen,
		userStore.settings.aiFeatureSet.showChatPanel,
		userStore.settings.aiBackendUrl,
		userStore.settings.aiBackendToken,
	] as const,
	async ([enabled, showChatPanel, backendUrl, backendToken]) => {
		const requestId = ++modelRequestId
		const normalizedBackendUrl = backendUrl?.trim() ?? ''
		const normalizedBackendToken = backendToken?.trim() ?? ''
		availableModels.value = []
		if (!enabled || !showChatPanel || !normalizedBackendUrl || !normalizedBackendToken) {
			userStore.settings.aiModelName = ''
			return
		}

		isLoadingModels.value = true
		try {
			const modelNames = await aiService.listModels()
			if (requestId !== modelRequestId) {
				return
			}

			availableModels.value = [...new Set(modelNames)].sort((left, right) => left.localeCompare(right))
			if (!availableModels.value.length) {
				userStore.settings.aiModelName = ''
				return
			}

			if (!userStore.settings.aiModelName || !availableModels.value.includes(userStore.settings.aiModelName)) {
				userStore.settings.aiModelName = availableModels.value.includes('iovlm')
					? 'iovlm'
					: availableModels.value[0] ?? ''
			}
		} catch {
			if (requestId === modelRequestId) {
				availableModels.value = []
			}
		} finally {
			if (requestId === modelRequestId) {
				isLoadingModels.value = false
			}
		}
	},
	{ immediate: true },
)

async function submitQuestion(questionText?: string) {
	const conversation = activeConversation.value
	if (!conversation || !canChat.value) {
		return
	}

	const question = (questionText ?? conversation.draft).trim()
	const activeDataItem = dataStore.activeDataItem
	if (!question || conversation.isSubmitting || !activeDataItem?.imageUrl) {
		return
	}
	const shouldAttachImage = !conversation.messages.some(
		(message) => message.role === 'user' && message.images?.some((image) => image.imageUrl === activeDataItem.imageUrl),
	)
	const userMessage: AIChatMessage = {
		role: 'user',
		content: question,
		images: shouldAttachImage ? [{ imageUrl: activeDataItem.imageUrl }] : undefined,
	}

	conversation.draft = ''
	conversation.messages.push(userMessage)
	await sendUserMessage(conversation, userMessage, conversation.messages.slice(0, -1))
}

async function sendUserMessage(conversation: ChatConversationState, userMessage: AIChatMessage, history: AIChatMessage[]) {
	conversation.isSubmitting = true

	try {
		const reply = await aiService.chatWithAgent({
			message: userMessage.content,
			model: userStore.settings.aiModelName || undefined,
			conversation: history,
			images: userMessage.images,
		})

		conversation.messages.push({
			role: 'assistant',
			content: reply.trim() || 'No answer returned.',
		})
	} catch {
		conversation.messages.push({
			role: 'assistant',
			content: 'The request failed. Check AI settings and backend availability, then try again.',
		})
	} finally {
		conversation.isSubmitting = false
	}
}

function beginEditMessage(index: number) {
	const conversation = activeConversation.value
	if (!conversation) {
		return
	}

	const message = conversation.messages[index]
	if (!message || message.role !== 'user' || conversation.isSubmitting) {
		return
	}

	conversation.editingIndex = index
	conversation.editingDraft = message.content
}

function cancelEditMessage() {
	const conversation = activeConversation.value
	if (!conversation) {
		return
	}

	conversation.editingIndex = null
	conversation.editingDraft = ''
}

async function saveEditedMessage(index: number) {
	const conversation = activeConversation.value
	if (!conversation || !canChat.value) {
		return
	}

	const message = conversation.messages[index]
	const content = conversation.editingDraft.trim()
	if (!message || message.role !== 'user' || !content) {
		return
	}

	const updatedMessage: AIChatMessage = { ...message, content }
	conversation.messages = [
		...conversation.messages.slice(0, index),
		updatedMessage,
	]
	cancelEditMessage()
	await sendUserMessage(conversation, updatedMessage, conversation.messages.slice(0, -1))
}

function onDraftKeydown(event: KeyboardEvent) {
	if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
		event.preventDefault()
		submitQuestion()
	}
}

function onEditDraftKeydown(event: KeyboardEvent, index: number) {
	if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
		event.preventDefault()
		saveEditedMessage(index)
	}
}
</script>

<template>
	<section class="h-full min-h-96 bg-white flex flex-col overflow-hidden pt-2 pb-4">
		<div class="border-b border-gray-200 px-4 py-2">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-900">Image Chat</h2>
					<p class="text-xs text-gray-500">Ask questions about the current image.</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="!activeConversation || activeConversation.isSubmitting || activeConversation.messages.length <= 1"
						@click="resetConversation"
					>
						Clear
					</button>
				</div>
			</div>
		</div>

		<div v-if="!hasActiveImage" class="px-4 py-6 text-sm text-gray-500">
			Select an image to start a conversation about it.
		</div>

		<template v-else>
			<div v-if="!hasAIConfig" class="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
				Enable AI-assisted labeling and provide the backend URL and token in Settings to use image chat.
			</div>

			<template v-if="activeConversation">
				<div class="px-4 pt-4" v-if="hasAIConfig">
					<label class="mb-1 block text-xs font-medium text-gray-600" for="chat-model-select">
						Model
					</label>
					<select
						id="chat-model-select"
						v-model="userStore.settings.aiModelName"
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:bg-gray-100"
						:disabled="activeConversation.isSubmitting || isLoadingModels || !availableModels.length"
					>
						<option value="" disabled>
							{{ isLoadingModels ? 'Loading models...' : 'Select a model' }}
						</option>
						<option v-for="modelName in availableModels" :key="modelName" :value="modelName">
							{{ modelName }}
						</option>
					</select>
				</div>

				<div ref="messageList" class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 bg-gray-50">
					<div
						v-for="(message, index) in activeConversation.messages"
						:key="`${message.role}-${index}`"
						class="flex flex-col gap-2"
					>
						<div
							v-for="image in message.images ?? []"
							:key="image.imageUrl"
							class="flex"
							:class="message.role === 'user' ? 'justify-end' : 'justify-start'"
						>
							<div
								class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
								:class="message.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'"
							>
								<img
									:src="image.imageUrl"
									alt="Attached image"
									class="h-24 w-24 object-cover"
								/>
							</div>
						</div>
						<div
							class="flex"
							:class="message.role === 'user' ? 'justify-end' : 'justify-start'"
						>
							<div class="w-[90%] flex flex-col gap-1.5">
								<div
									v-if="activeConversation.editingIndex === index"
									class="rounded-2xl border border-blue-200 bg-white p-2 shadow-sm"
								>
									<textarea
										v-model="activeConversation.editingDraft"
										rows="3"
										class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
										@keydown="onEditDraftKeydown($event, index)"
									/>
									<div class="mt-2 flex justify-end gap-2">
										<button
											type="button"
											class="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
											@click="cancelEditMessage"
										>
											Cancel
										</button>
										<button
											type="button"
											class="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
											:disabled="!activeConversation.editingDraft.trim() || !canChat"
											@click="saveEditedMessage(index)"
										>
											Save
										</button>
									</div>
								</div>
								<div
									v-else
									class="rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm whitespace-pre-wrap"
									:class="message.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'"
								>
									{{ message.content }}
								</div>
								<div v-if="message.role === 'user' && activeConversation.editingIndex !== index" class="flex justify-end">
									<button
										type="button"
										class="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
										:disabled="!canChat || activeConversation.isSubmitting"
										@click="beginEditMessage(index)"
										aria-label="Edit message and discard following replies"
										title="Edit message and discard following replies"
									>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4l10.5-10.5a2.121 2.121 0 10-3-3L5 17v3z" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
					<div v-if="activeConversation.isSubmitting" class="flex justify-start">
						<div class="rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
							Thinking...
						</div>
					</div>
				</div>

				<div class="border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-3">
					<ChatPanelQueries
						v-model="predefinedQueries"
						:disabled="!canChat || activeConversation.isSubmitting"
						@submit="submitQuestion"
					/>

					<form class="flex flex-col gap-2" @submit.prevent="submitQuestion()">
						<textarea
							v-model="activeConversation.draft"
							rows="4"
							class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-100"
							placeholder="Ask a question about the image"
							:disabled="!canChat || activeConversation.isSubmitting"
							@keydown="onDraftKeydown"
						/>
						<div class="flex justify-end">
							<button
								type="submit"
								class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								:disabled="!activeConversation.draft.trim() || !canChat || activeConversation.isSubmitting"
							>
								Send
							</button>
						</div>
					</form>
				</div>
			</template>
		</template>
	</section>
</template>
