/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
}

export const getModelConfig = (): ModelConfig => ({
  apiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
  baseUrl: (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
  visionModel: process.env.OPENAI_VISION_MODEL?.trim() ?? ''
});

export const isModelConfigured = (config: ModelConfig) => Boolean(config.apiKey && config.visionModel);
