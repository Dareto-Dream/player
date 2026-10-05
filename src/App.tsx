import Directory from "./Directory";
import RoomView from "./RoomView";
import RoomSettings, { ConnectApp, MyRooms } from "./RoomSettings";
import StreamerRoom from "./StreamerRoom";

export default function App() {
  const settings = /^\/rooms\/([^/]+)\/settings\/?$/.exec(
    window.location.pathname,
  );
  if (settings) return <RoomSettings id={decodeURIComponent(settings[1])} />;
  const connect = /^\/connect\/([a-f0-9]{32})\/?$/.exec(
    window.location.pathname,
  );
  if (connect) return <ConnectApp code={connect[1]} />;
  if (window.location.pathname === "/my") return <MyRooms />;
  const queue = /^\/queues\/([^/]+)\/?$/.exec(window.location.pathname);
  if (queue) return <StreamerRoom id={decodeURIComponent(queue[1])} />;
  const path = /^\/(rooms|sessions)\/([^/]+)\/?$/.exec(
    window.location.pathname,
  );
  if (path)
    return (
      <RoomView
        id={decodeURIComponent(path[2])}
        privateSession={path[1] === "sessions"}
      />
    );
  return <Directory />;
}
