<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AIService } from '@/api'
import type { AIChatMessage } from '@/openai-client'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'

const CHAT_AGENT = {
	name: 'image-labeling-assistant',
	instructions: 'Help the user inspect the current image and answer questions grounded in the visible content.',
}
const INITIAL_ASSISTANT_MESSAGE = 'Ask about the current image. I will answer using the visible content and current labeling context.'

const dataStore = useDataStore()
const userStore = useUserStore()
const aiService = new AIService()

const draft = ref('')
const isSubmitting = ref(false)
const messages = ref<AIChatMessage[]>([])
const messageList = ref<HTMLDivElement | null>(null)

const hasActiveImage = computed(() => Boolean(dataStore.activeDataItem?.imageUrl))
const hasAIConfig = computed(() => {
	const settings = userStore.settings
	return settings.enableAIAutoGen && Boolean(settings.aiBackendUrl?.trim()) && Boolean(settings.aiBackendToken?.trim())
})

const suggestedQuestions = [
	'What should I pay attention to in this image?',
	'What structures or findings are clearly visible?',
	'What details are uncertain or ambiguous here?',
]

watch(() => dataStore.activeDataItem?.fileName, () => {
	draft.value = ''
	messages.value = hasActiveImage.value
		? [{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }]
		: []
}, { immediate: true })

watch(() => messages.value.length, () => {
	nextTick(() => {
		messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
	})
})

async function submitQuestion(questionText?: string) {
	const question = (questionText ?? draft.value).trim()
	const activeDataItem = dataStore.activeDataItem
	if (!question || isSubmitting.value || !activeDataItem?.imageUrl) {
		return
	}
	const activeFileName = activeDataItem.fileName

	draft.value = ''
	messages.value.push({ role: 'user', content: question })
	isSubmitting.value = true

	try {
		const history = messages.value.slice(0, -1)
		const reply = await aiService.chatWithAgent({
			message: question,
			conversation: history,
			agent: CHAT_AGENT,
			images: [{ imageUrl: activeDataItem.imageUrl }],
		})

		if (dataStore.activeDataItem?.fileName !== activeFileName) {
      console.warn('Active image changed during AI response, discarding the reply.')
			return
		}

		messages.value.push({
			role: 'assistant',
			content: reply.trim() || 'No answer returned.',
		})
	} catch {
		if (dataStore.activeDataItem?.fileName !== activeFileName) {
      console.warn('Active image changed during AI response, ignoring the error.')
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
</script>

<template>
	<section class="h-full min-h-96 rounded-lg bg-white shadow-md flex flex-col overflow-hidden">
		<div class="border-b border-gray-200 px-4 py-3">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-900">Image Chat</h2>
					<p class="text-xs text-gray-500">Ask questions about the current image.</p>
				</div>
				<span
					class="rounded-full px-2.5 py-1 text-xs font-medium"
					:class="hasAIConfig ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
				>
					{{ hasAIConfig ? 'Ready' : 'Setup needed' }}
				</span>
			</div>
		</div>

		<div v-if="!hasActiveImage" class="px-4 py-6 text-sm text-gray-500">
			Select an image to start a conversation about it.
		</div>

		<template v-else>
			<div v-if="!hasAIConfig" class="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
				Enable AI-assisted labeling and provide the backend URL and token in Settings to use image chat.
			</div>

			<div ref="messageList" class="flex-1 space-y-3 overflow-y-auto px-4 py-4 bg-gray-50">
				<div
					v-for="(message, index) in messages"
					:key="`${message.role}-${index}`"
					class="flex"
					:class="message.role === 'user' ? 'justify-end' : 'justify-start'"
				>
					<div
						class="max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm whitespace-pre-wrap"
						:class="message.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'"
					>
						{{ message.content }}
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
						class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="!hasAIConfig || isSubmitting"
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
						:disabled="!hasAIConfig || isSubmitting"
					/>
					<div class="flex justify-end">
						<button
							type="submit"
							class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							:disabled="!draft.trim() || !hasAIConfig || isSubmitting"
						>
							Send
						</button>
					</div>
				</form>
			</div>
		</template>
	</section>
</template>
