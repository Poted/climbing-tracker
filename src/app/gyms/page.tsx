import { getGyms } from '@/lib/actions'
import GymClient from './GymClient'

export default async function GymsPage() {
  const gyms = await getGyms()
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Gyms & Grade Scales</h1>
      <GymClient initialGyms={gyms} />
    </div>
  )
}
