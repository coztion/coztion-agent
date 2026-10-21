export type TodoItem = { text: string; isDone: boolean }
export type TodoList = { title: string; items: TodoItem[] }

declare module 'claude-code' {
  interface PluginState {
    'todo-pane': {
      lists: TodoList[]
      currentTitle: string
      isOpenOnly: boolean
      isClosed: boolean
    }
  }
}
