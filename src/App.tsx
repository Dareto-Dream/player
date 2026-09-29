import Directory from './Directory'
import RoomView from './RoomView'

export default function App() {
  const path = /^\/(rooms|sessions)\/([^/]+)\/?$/.exec(window.location.pathname)
  if (path)
    return (
      <RoomView
        id={decodeURIComponent(path[2])}
        privateSession={path[1] === 'sessions'}
      />
    )
  return <Directory />
}
