import { getPlan, getTrainingUnits } from '@/lib/actions'
import PlanClient from './PlanClient'

export default async function PlanPage() {
  const [plan, units] = await Promise.all([getPlan(), getTrainingUnits()])
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Training Plan</h1>
      <PlanClient initialPlan={plan} units={units} />
    </div>
  )
}
