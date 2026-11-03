import type {TokenPrices} from "../domain/limits";
export const MODELS = {
  "gpt-6.1-sol": {inputMicrosPerMillion:2_000_000n,outputMicrosPerMillion:10_000_000n},
  "gpt-6.1-terra": {inputMicrosPerMillion:1_000_000n,outputMicrosPerMillion:5_000_000n},
} satisfies Record<string,TokenPrices>;
export type ModelId=keyof typeof MODELS;
export const PROMPT_VERSIONS={meaning:"meaning-v1",plan:"plan-v1"} as const;
export const TOKEN_CAPS={meaning:4000,plan:3000} as const;
