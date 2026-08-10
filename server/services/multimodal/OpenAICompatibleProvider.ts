/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfig } from '../../config/modelConfig';
import { assignmentAnalysisJsonSchema, assignmentAnalysisSchema } from '../../schemas/assignmentAnalysis';
import { AssignmentAnalysisInput, MultimodalProvider } from './MultimodalProvider';

export class OpenAICompatibleProvider implements MultimodalProvider {
  constructor(private readonly config: ModelConfig) {}

  async analyzeAssignment(input: AssignmentAnalysisInput) {
    const catalog = input.knowledgeCatalog.map(item => `${item.id}\t${item.type}\t${item.name}\t${item.description}`).join('\n');
    const content: Array<Record<string, unknown>> = [{
      type: 'text',
      text: `分析作业题目和参考答案，识别题号及子题层级，将答案匹配到题目并生成采分点。知识点只能从下列资源库节点中选择并返回真实 nodeId；没有合适节点时返回空数组。\n\n资源库：\n${catalog}`
    }];

    for (const file of input.files) {
      if (!file.mimeType.startsWith('image/')) throw new Error('MODEL_INPUT_REQUIRES_RENDERED_IMAGE');
      content.push({ type: 'text', text: `${file.kind === 'assignment' ? '题目' : '参考答案'}文件：${file.fileName}` });
      content.push({ type: 'image_url', image_url: { url: `data:${file.mimeType};base64,${file.dataBase64}`, detail: 'high' } });
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.visionModel,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_schema', json_schema: { name: 'assignment_analysis', strict: true, schema: assignmentAnalysisJsonSchema } },
        temperature: 0
      })
    });

    if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new Error('MODEL_EMPTY_RESPONSE');
    return assignmentAnalysisSchema.parse(JSON.parse(raw));
  }
}
