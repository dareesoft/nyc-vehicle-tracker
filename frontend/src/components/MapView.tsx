import { useTripStore } from '../stores/tripStore'
import Map2D from './Map2D'
import Map3D from './Map3D'

export default function MapView() {
  const { viewMode } = useTripStore()
  
  return (
    <div className="absolute inset-0">
      {viewMode === '2d' ? <Map2D /> : <Map3D />}
    </div>
  )
}

