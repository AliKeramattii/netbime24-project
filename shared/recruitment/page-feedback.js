export function createAnnouncer(region) {
  let frame;
  return message => {
    cancelAnimationFrame(frame);
    region.textContent = "";
    frame = requestAnimationFrame(() => { region.textContent = message; });
  };
}
