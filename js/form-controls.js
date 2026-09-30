// Registration renders one form at a time. Dispose popovers before replacing it.
const controls = new Set();
export function trackFormControl(control) { controls.add(control); return control; }
export function disposeFormControls() {
  for (const control of controls) control.close(false);
  controls.clear();
}
