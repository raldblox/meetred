import { jsonBlockPrompt } from '@llm-ui/json'
import z from 'zod'

export const AGENT_BUTTONS_BLOCK_OPTIONS = {
  type: 'buttons',
  startChar: '<<<',
  endChar: '>>>',
  typeKey: 'type',
  defaultVisible: false,
} as const

const agentButtonsSchema = z.object({
  type: z.literal('buttons'),
  title: z.string().optional(),
  buttons: z.array(
    z.object({
      text: z.string(),
      prompt: z.string(),
    }),
  ),
})

export const AGENT_BUTTONS_PROMPT = jsonBlockPrompt({
  name: 'ActionButtons',
  schema: agentButtonsSchema,
  examples: [
    {
      type: 'buttons',
      title: 'Next steps',
      buttons: [
        { text: 'Summarize', prompt: 'Summarize the key points.' },
        { text: 'Draft reply', prompt: 'Draft a short reply using the main idea.' },
      ],
    },
  ],
  options: AGENT_BUTTONS_BLOCK_OPTIONS,
})

export const AGENT_UI_SYSTEM_PROMPT = [
  'You can optionally include an ActionButtons JSON block to suggest next actions.',
  'Only include the block when it adds value. Otherwise respond with normal markdown.',
  AGENT_BUTTONS_PROMPT.trim(),
].join('\n\n')
