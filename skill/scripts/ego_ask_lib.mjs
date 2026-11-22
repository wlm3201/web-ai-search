// Back-compat shim: the engine moved to engine.mjs.
// Old scripts that `import ... from './ego_ask_lib.mjs'` keep working.
export * from './engine.mjs';
