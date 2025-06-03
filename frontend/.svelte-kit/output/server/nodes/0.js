import * as universal from '../entries/pages/_layout.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.BBIKm_IX.js","_app/immutable/chunks/VlzhU-cE.js","_app/immutable/chunks/DO95TrpH.js","_app/immutable/chunks/z1_h_S-m.js","_app/immutable/chunks/CKvl8f00.js","_app/immutable/chunks/DePN81sB.js","_app/immutable/chunks/KzdxLMOR.js","_app/immutable/chunks/DPUg7jpB.js","_app/immutable/chunks/BCl9OAM7.js"];
export const stylesheets = ["_app/immutable/assets/0.DdFKKIS_.css"];
export const fonts = [];
