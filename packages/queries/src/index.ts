// Module augmentation for `mutation.meta` (`Register.mutationMeta`). Erased at
// build time, so it carries no runtime import — but it must live in the entry
// module so consumers inherit the augmentation without a tsconfig hack.
/// <reference path="../tanstack-query.d.ts" />

export * from "./audit.query";
export * from "./user.query";
