import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useSourceRecords(entity) {
  const [state, setState] = useState({ data: [], loading: true, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiUrl}/api/v1/source/${entity}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `Unable to load ${entity}`)
        setState({ data: result.data, loading: false, error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: [], loading: false, error: error.message })
      })
    return () => controller.abort()
  }, [entity])

  return state
}
