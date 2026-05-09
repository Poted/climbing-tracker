import { getTrainingUnits } from '@/lib/actions'
import UnitsClient from './UnitsClient'

export default async function UnitsPage() {
  const units = await getTrainingUnits()
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Training Units</h1>
      <UnitsClient initialUnits={units} />
    </div>
  )
}
