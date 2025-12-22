import { fetchLMStudioModels, type LMStudioModel } from '@/lib/lmstudio'

export type AgentSourceType = 'lmstudio-local' | 'api-key' | 'remote-peer'

export interface AgentManagerState {
  sourceType: AgentSourceType | null
  status: 'idle' | 'connecting' | 'ready' | 'error'
  models: LMStudioModel[]
  selectedModelId: string | null
  baseUrl?: string
  error?: string | null
}

type AgentManagerListener = (state: AgentManagerState) => void

export const createAgentManagerState = (): AgentManagerState => ({
  sourceType: null,
  status: 'idle',
  models: [],
  selectedModelId: null,
  baseUrl: undefined,
  error: null,
})

export class AgentManager {
  private state: AgentManagerState = createAgentManagerState()
  private listeners = new Set<AgentManagerListener>()

  subscribe(listener: AgentManagerListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): AgentManagerState {
    return this.state
  }

  private setState(update: Partial<AgentManagerState>) {
    this.state = {
      ...this.state,
      ...update,
    }
    this.listeners.forEach((listener) => listener(this.state))
  }

  reset(): void {
    this.setState(createAgentManagerState())
  }

  selectModel(modelId: string | null): void {
    this.setState({
      selectedModelId: modelId,
    })
  }

  async connectLocalLMStudio(baseUrl: string): Promise<void> {
    this.setState({
      sourceType: 'lmstudio-local',
      status: 'connecting',
      baseUrl,
      error: null,
    })

    try {
      const models = await fetchLMStudioModels(baseUrl)

      if (models.length === 0) {
        this.setState({
          status: 'error',
          models: [],
          selectedModelId: null,
          error: 'No models detected. Open LM Studio and ensure at least one model is loaded.',
        })

        return
      }

      this.setState({
        status: 'ready',
        models,
        selectedModelId: models[0]?.id ?? null,
        error: null,
      })
    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error?.message ?? 'Failed to connect to LM Studio',
      })
      throw error
    }
  }
}
