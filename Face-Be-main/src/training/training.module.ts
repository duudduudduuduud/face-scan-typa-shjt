import { BadRequestException, Body, Controller, Get, Module, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles';
import { object } from '../common/validation';

@ApiTags('ai-training')
@ApiBearerAuth()
@Roles('teacher', 'admin')
@Controller('ai-training')
export class TrainingController {
  private async ai(path: string, body: unknown): Promise<Record<string, unknown>> {
    const key = process.env.AI_SERVICE_KEY ?? '';
    if (key.length < 32) throw new ServiceUnavailableException('Configure AI_SERVICE_KEY in BE and AI');
    let response: globalThis.Response;
    try {
      response = await fetch(`${(process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8001').replace(/\/$/, '')}/training/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
      });
    } catch { throw new ServiceUnavailableException('AI service is unavailable. Start python -m ai.web_server'); }
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      if (response.status === 400) throw new BadRequestException(result?.message ?? 'Invalid training request');
      throw new ServiceUnavailableException('AI training service failed');
    }
    if (!result) throw new ServiceUnavailableException('Invalid AI response');
    return result;
  }
  @Get()
  @ApiOperation({ summary: 'Dataset, training progress and model evaluation history' })
  status() { return this.ai('status', {}); }
  @Post('jobs')
  @ApiOperation({ summary: 'Start session-separated SVM training in the background' })
  start(@Body() body: unknown) { object(body, []); return this.ai('start', {}); }
  @Post('activate')
  @ApiOperation({ summary: 'Use a trained model, or null to return to gallery matching' })
  @ApiBody({ schema: { type: 'object', required: ['version'], properties: { version: { type: 'string', nullable: true } } } })
  activate(@Body() body: unknown) {
    const data = object(body, ['version']);
    if (data.version !== null && (typeof data.version !== 'string' || !/^[a-f0-9]{32}$/.test(data.version)))
      throw new BadRequestException('version must be a model ID or null');
    return this.ai('activate', { version: data.version });
  }
}
@Module({ controllers: [TrainingController] })
export class TrainingModule {}
