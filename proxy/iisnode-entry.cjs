// Startup file for IIS/iisnode (Plesk Windows). iisnode loads the startup file with require(),
// which cannot load the ES module server.js directly on every Node version; a dynamic import can.
import("./server.js").catch((error) => {
  console.error("NetBime24 proxy failed to start:", error?.message || error);
  process.exit(1);
});
