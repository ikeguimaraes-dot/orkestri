'use client'

export default function OrquestradorError({ error }: { error: Error }) {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-red-600 font-bold text-lg">Erro no Orquestrador</h1>
      <pre className="text-xs bg-red-50 text-red-900 p-4 rounded overflow-auto">
        {error.message}
      </pre>
      <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
        {error.stack}
      </pre>
    </div>
  )
}