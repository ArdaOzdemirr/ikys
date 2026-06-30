import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ParsedCvData {
  skills: string[];
  languages: string[];
  experienceYears: number | null;
  summary: string;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_cv_data',
  description: 'CV içeriğinden yapılandırılmış aday bilgisi çıkarır.',
  input_schema: {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'CV\'de geçen teknik/mesleki yetkinlikler (kısa, tekil terimler).',
      },
      languages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Bilinen diller (örn. "İngilizce (İleri)").',
      },
      experienceYears: {
        type: 'integer',
        description: 'Toplam tahmini iş deneyimi (yıl). Belirsizse en yakın tam sayı.',
      },
      summary: {
        type: 'string',
        description: 'Adayın 2-3 cümlelik Türkçe özeti (deneyim alanı, öne çıkan yönleri).',
      },
    },
    required: ['skills', 'languages', 'experienceYears', 'summary'],
  },
};

/**
 * CV dosyasından (PDF/resim) Claude API ile yapılandırılmış veri çıkarır.
 * DOC/DOCX desteklenmez (Claude'un document bloğu yalnızca PDF kabul eder).
 */
@Injectable()
export class CvParserService {
  private readonly logger = new Logger('CvParserService');

  private getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async parse(buffer: Buffer, mimeType: string): Promise<ParsedCvData> {
    const client = this.getClient();
    if (!client) {
      throw new Error(
        'ANTHROPIC_API_KEY tanımlı değil; CV ayrıştırma için backend/.env içine ekleyin.',
      );
    }

    let contentBlock: Anthropic.Messages.ContentBlockParam;
    if (mimeType === 'application/pdf') {
      contentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: buffer.toString('base64'),
        },
      };
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      contentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: buffer.toString('base64'),
        },
      };
    } else {
      throw new Error(
        'Bu dosya türü AI ile ayrıştırılamıyor (yalnızca PDF, JPG veya PNG desteklenir).',
      );
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_cv_data' },
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: 'Bu CV\'yi incele ve extract_cv_data aracını kullanarak yapılandırılmış bilgi çıkar.',
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude API bu CV içeriğini işlemeyi reddetti.');
    }

    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      throw new Error('Claude API beklenen yapılandırılmış yanıtı döndürmedi.');
    }

    const input = toolUse.input as Partial<ParsedCvData>;
    return {
      skills: Array.isArray(input.skills) ? input.skills.slice(0, 30) : [],
      languages: Array.isArray(input.languages) ? input.languages.slice(0, 10) : [],
      experienceYears:
        typeof input.experienceYears === 'number' ? input.experienceYears : null,
      summary: typeof input.summary === 'string' ? input.summary : '',
    };
  }
}
