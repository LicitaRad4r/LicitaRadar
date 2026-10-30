import { useSaudeApi } from '@/api/saude'
import { API_MOCK } from '@/api/config'

function StatusApi() {
  const saude = useSaudeApi()
  const texto = saude.isPending
    ? 'Verificando a API...'
    : saude.isError
      ? 'API fora do ar'
      : API_MOCK
        ? 'API simulada (mock)'
        : 'API no ar'
  const cor = saude.isError ? 'bg-destructive' : saude.isPending ? 'bg-muted-foreground' : 'bg-emerald-500'

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className={`size-2 rounded-full ${cor}`} />
      {texto}
    </p>
  )
}

function App() {
  return (
    <div className="space-y-4 p-8">
      <h1 className="text-4xl font-bold text-purple-600">LicitaRadar</h1>
      <StatusApi />
    </div>
  )
}

export default App
