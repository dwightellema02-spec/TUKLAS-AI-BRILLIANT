/**
 * A TCP proxy in front of a real PostgreSQL that can be switched off and on, to imitate a hosted database that is asleep or restarting.
 * Off = the port refuses connections and open connections are cut, exactly what a client sees while a database is unreachable.
 */
import net from "net";

export function createFlakyProxy(port: number, target: { host: string; port: number }) {
  let server: net.Server | undefined;
  const sockets = new Set<net.Socket>();
  const open = () => new Promise<void>((resolve, reject) => {
    server = net.createServer((client) => {
      const upstream = net.connect(target.port, target.host);
      sockets.add(client); sockets.add(upstream);
      client.pipe(upstream); upstream.pipe(client);
      const done = () => { client.destroy(); upstream.destroy(); sockets.delete(client); sockets.delete(upstream); };
      client.on("error", done); upstream.on("error", done); client.on("close", done); upstream.on("close", done);
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return {
    start: open,
    /** Refuse new connections and cut the existing ones. */
    async down() { for (const s of sockets) s.destroy(); sockets.clear(); await new Promise<void>((r) => (server ? server.close(() => r()) : r())); server = undefined; },
    async up() { if (!server) await open(); },
    isUp: () => !!server,
  };
}
