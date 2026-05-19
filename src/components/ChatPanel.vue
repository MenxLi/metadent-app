<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AIService } from '@/api'
import type { AIChatMessage } from '@/openai-client'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'

const INITIAL_ASSISTANT_MESSAGE = 'Ask about the current image. I will answer using the visible content.'

const dataStore = useDataStore()
const userStore = useUserStore()
const aiService = new AIService()
let modelRequestId = 0

const draft = ref('')
const isSubmitting = ref(false)
const isLoadingModels = ref(false)
const messages = ref<AIChatMessage[]>([])
const messageList = ref<HTMLDivElement | null>(null)
const availableModels = ref<string[]>([])
const editingIndex = ref<number | null>(null)
const editingDraft = ref('')

const hasActiveImage = computed(() => Boolean(dataStore.activeDataItem?.imageUrl))
const hasAIConfig = computed(() => {
	const settings = userStore.settings
	return settings.enableAIAutoGen && Boolean(settings.aiBackendUrl?.trim()) && Boolean(settings.aiBackendToken?.trim())
})
const canChat = computed(() => hasAIConfig.value && Boolean(userStore.settings.aiModelName))

const suggestedQuestions = [
  '帮我详细描述一下这张图的内容，围绕图像内的可见内容进行介绍，全面总结画面主体内容，总结为一段话',
]

function resetConversation() {
	draft.value = ''
	editingIndex.value = null
	editingDraft.value = ''
	messages.value = hasActiveImage.value
		? [{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }]
		: []
}

watch(() => dataStore.activeDataItem?.fileName, () => {
	resetConversation()
}, { immediate: true })

watch(() => messages.value.length, () => {
	nextTick(() => {
		messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
	})
})

watch(
	() => [
		userStore.settings.enableAIAutoGen,
		userStore.settings.aiBackendUrl,
		userStore.settings.aiBackendToken,
	] as const,
	async ([enabled, backendUrl, backendToken]) => {
		const requestId = ++modelRequestId
		availableModels.value = []
		if (!enabled || !backendUrl.trim() || !backendToken.trim()) {
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
	const question = (questionText ?? draft.value).trim()
	const activeDataItem = dataStore.activeDataItem
	if (!question || isSubmitting.value || !activeDataItem?.imageUrl) {
		return
	}
	const activeFileName = activeDataItem.fileName
	const shouldAttachImage = !messages.value.some(
		(message) => message.role === 'user' && message.images?.some((image) => image.imageUrl === activeDataItem.imageUrl),
	)
	const userMessage: AIChatMessage = {
		role: 'user',
		content: question,
		images: shouldAttachImage ? [{ imageUrl: activeDataItem.imageUrl }] : undefined,
	}

	draft.value = ''
	messages.value.push(userMessage)
	await sendUserMessage(userMessage, messages.value.slice(0, -1), activeFileName)
}

async function sendUserMessage(userMessage: AIChatMessage, history: AIChatMessage[], activeFileName: string) {
	isSubmitting.value = true

	try {
		const reply = await aiService.chatWithAgent({
			message: userMessage.content,
			model: userStore.settings.aiModelName || undefined,
			conversation: history,
			images: userMessage.images,
		})

		if (dataStore.activeDataItem?.fileName !== activeFileName) {
			return
		}

		messages.value.push({
			role: 'assistant',
			content: reply.trim() || 'No answer returned.',
		})
	} catch {
		if (dataStore.activeDataItem?.fileName !== activeFileName) {
			return
		}

		messages.value.push({
			role: 'assistant',
			content: 'The request failed. Check AI settings and backend availability, then try again.',
		})
	} finally {
		isSubmitting.value = false
	}
}

function beginEditMessage(index: number) {
	const message = messages.value[index]
	if (!message || message.role !== 'user' || isSubmitting.value) {
		return
	}

	editingIndex.value = index
	editingDraft.value = message.content
}

function cancelEditMessage() {
	editingIndex.value = null
	editingDraft.value = ''
}

async function saveEditedMessage(index: number) {
	const message = messages.value[index]
	const content = editingDraft.value.trim()
	const activeFileName = dataStore.activeDataItem?.fileName
	if (!message || message.role !== 'user' || !content || !activeFileName) {
		return
	}

	const updatedMessage: AIChatMessage = { ...message, content }
	messages.value = [
		...messages.value.slice(0, index),
		updatedMessage,
	]
	cancelEditMessage()
	await sendUserMessage(updatedMessage, messages.value.slice(0, -1), activeFileName)
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
	<section class="h-full min-h-96 rounded-lg bg-white shadow-md flex flex-col overflow-hidden">
		<div class="border-b border-gray-200 px-4 py-3">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-900">Image Chat</h2>
					<p class="text-xs text-gray-500">Ask questions about the current image.</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="isSubmitting || messages.length <= 1"
						@click="resetConversation"
					>
						Clear
					</button>
					<span
						class="rounded-full px-2.5 py-1 text-xs font-medium"
						:class="hasAIConfig ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
					>
						{{ hasAIConfig ? 'Ready' : 'Setup needed' }}
					</span>
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

			<div class="px-4 pt-4" v-if="hasAIConfig">
				<label class="mb-1 block text-xs font-medium text-gray-600" for="chat-model-select">
					Model
				</label>
				<select
					id="chat-model-select"
					v-model="userStore.settings.aiModelName"
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:bg-gray-100"
					:disabled="isSubmitting || isLoadingModels || !availableModels.length"
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
					v-for="(message, index) in messages"
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
						<div class="max-w-[90%] flex flex-col gap-1.5">
							<div
								v-if="editingIndex === index"
								class="rounded-2xl border border-blue-200 bg-white p-2 shadow-sm"
							>
								<textarea
									v-model="editingDraft"
									rows="3"
									class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
									@keydown="onEditDraftKeydown($event, index)"
								/>
								<div class="mt-2 flex justify-end gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
										@click="cancelEditMessage"
									>
										Cancel
									</button>
									<button
										type="button"
										class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
										:disabled="!editingDraft.trim()"
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
							<div v-if="message.role === 'user' && editingIndex !== index" class="flex justify-end">
								<button
									type="button"
									class="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
									:disabled="isSubmitting"
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
				<div v-if="isSubmitting" class="flex justify-start">
					<div class="rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
						Thinking...
					</div>
				</div>
			</div>

			<div class="border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-3">
				<div class="flex flex-wrap gap-2">
					<button
						v-for="question in suggestedQuestions"
						:key="question"
						type="button"
						class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 text-left"
						:disabled="!canChat || isSubmitting"
						@click="submitQuestion(question)"
					>
						{{ question }}
					</button>
				</div>

				<form class="flex flex-col gap-2" @submit.prevent="submitQuestion()">
					<textarea
						v-model="draft"
						rows="4"
						class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-100"
						placeholder="Ask a question about the image"
						:disabled="!canChat || isSubmitting"
						@keydown="onDraftKeydown"
					/>
					<div class="flex justify-end">
						<button
							type="submit"
							class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							:disabled="!draft.trim() || !canChat || isSubmitting"
						>
							Send
						</button>
					</div>
				</form>
			</div>
		</template>
	</section>
</template>
