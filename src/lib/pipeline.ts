import { Industry, getIndustryById, getAllIndustries } from './industry-data';
import { queryNvidiaRaw } from './nvidia';
import { queryGroqRaw } from './groq';
import { queryOpenAIRaw } from './openai';
import { queryGeminiRaw } from './gemini';
import { queryVertexGeminiRaw } from './vertex-gemini';
import { queryVertexClaudeRaw } from './vertex-claude';
import { queryVertexGrokRaw } from './vertex-grok';
import { generateBatchIndustryPrompt, parseBatchIndustryResponse, BatchBrandScore } from './prompts';
import { hasApiKeys } from './env';

export interface BrandAnalysisResult {
  brand: string;
  industry: string;
  category: string;
  score: number;
  breakdown: {
    recommendation: number;
    sentiment: number;
    prominence: number;
    accuracy: number;
  };
  responses: Array<{
    model: string;
    modelType: "free" | "pro";
    text: string;
    sentiment: "positive" | "neutral" | "negative";
    mentionsCount: number;
  }>;
  responseTime: number;
  timestamp: string;
  error?: string;
}

export interface IndustryAnalysisResult {
  industry: Industry;
  brandResults: BrandAnalysisResult[];
  modelData: { model: string; brandScores: BatchBrandScore[] }[];
  industryAverage: {
    score: number;
    recommendation: number;
    sentiment: number;
    prominence: number;
    accuracy: number;
  };
  topPerformers: BrandAnalysisResult[];
  bottomPerformers: BrandAnalysisResult[];
  totalResponseTime: number;
  timestamp: string;
  error?: string;
}

export interface PipelineConfig {
  delayBetweenIndustries: number;
  timeoutMs: number;
  /** Retry delays in ms for failed model queries. Default: [30000, 60000, 90000] */
  retryDelaysMs: number[];
  /** If set, only run this specific model pair instead of all providers */
  modelPair?: { provider: 'openai' | 'gemini' | 'groq' | 'nvidia' | 'vertex-gemini' | 'vertex-claude' | 'vertex-grok'; primary: string; backup: string; apiKeyOverride?: string };
}

// Default retry delays: 30s → 60s → 90s (for GitHub Actions rate limits)
const DEFAULT_RETRY_DELAYS = [30_000, 60_000, 90_000];

export class BrandAnalysisPipeline {
  private config: PipelineConfig;
  private apiKeys: ReturnType<typeof hasApiKeys>;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      delayBetweenIndustries: 5000,
      timeoutMs: 120000,
      retryDelaysMs: DEFAULT_RETRY_DELAYS,
      ...config
    };
    this.apiKeys = hasApiKeys();
  }

  async analyzeIndustry(industryId: string, customIndustries?: Industry[]): Promise<IndustryAnalysisResult> {
    let industry = customIndustries ? customIndustries.find(i => i.id === industryId) : getIndustryById(industryId);
    if (!industry) {
      industry = getIndustryById(industryId); // fallback
      if (!industry) {
        throw new Error(`Industry not found: ${industryId}`);
      }
    }

    console.log(`  📋 ${industry.name} (${industry.topBrands.length} brands)...`);
    const startTime = Date.now();

    try {
      // Single batch prompt for all brands in this industry
      const prompt = generateBatchIndustryPrompt(industry.topBrands, industry.category);
      const modelResults = await this.queryAllModels(prompt);

      // Aggregate scores across models
      const brandResults = this.aggregateBatchResults(modelResults, industry);
      const industryAverage = this.calculateIndustryAverage(brandResults);
      const topPerformers = this.getTopPerformers(brandResults, 5);
      const bottomPerformers = this.getBottomPerformers(brandResults, 3);
      const totalResponseTime = Date.now() - startTime;

      const successCount = brandResults.filter(b => !b.error).length;
      console.log(`  ✅ ${industry.name}: ${successCount}/${industry.topBrands.length} brands scored in ${Math.round(totalResponseTime / 1000)}s`);

      return {
        industry,
        brandResults,
        modelData: modelResults.map(m => ({ model: m.model, brandScores: m.scores })),
        industryAverage,
        topPerformers,
        bottomPerformers,
        totalResponseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`  ❌ ${industry.name} failed:`, error instanceof Error ? error.message : error);
      return {
        industry,
        brandResults: [],
        modelData: [],
        industryAverage: { score: 0, recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 },
        topPerformers: [],
        bottomPerformers: [],
        totalResponseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async analyzeAllIndustries(industries?: Industry[]): Promise<IndustryAnalysisResult[]> {
    if (!industries) {
      industries = getAllIndustries();
    }
    console.log(`Starting pipeline: ${industries.length} industries (1 request per industry per model)\n`);
    
    const results: IndustryAnalysisResult[] = [];
    
    for (let i = 0; i < industries.length; i++) {
      const industry = industries[i];
      try {
        const result = await this.analyzeIndustry(industry.id, industries);
        results.push(result);
        
        // Delay between industries to respect rate limits
        if (i < industries.length - 1 && this.config.delayBetweenIndustries > 0) {
          await this.delay(this.config.delayBetweenIndustries);
        }
      } catch (error) {
        console.error(`Failed to analyze industry ${industry.name}:`, error);
      }
    }
    
    return results;
  }

  private async queryAllModels(prompt: string): Promise<{ model: string; scores: BatchBrandScore[] }[]> {
    const perModelTimeout = this.config.timeoutMs; // timeout per model, not global

    // Helper: wrap a query with its own timeout
    const withTimeout = <T>(promise: Promise<T>, model: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${model} timed out after ${perModelTimeout / 1000}s`)), perModelTimeout)
        ),
      ]);
    };

    // Helper: wrap a query with retries (30s, 60s, 90s delays)
    const withRetry = async <T>(
      queryFn: () => Promise<T>,
      model: string,
    ): Promise<T> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.config.retryDelaysMs.length; attempt++) {
        try {
          return await withTimeout(queryFn(), model);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const isQuota = lastError.message.includes('429') || lastError.message.includes('quota') || lastError.message.includes('rate');

          if (attempt < this.config.retryDelaysMs.length) {
            const delay = this.config.retryDelaysMs[attempt];
            console.warn(`    ⚠ ${model} attempt ${attempt + 1} failed${isQuota ? ' (rate-limit)' : ''}: ${lastError.message.split('\n')[0]}`);
            console.warn(`    ⏳ Retrying in ${delay / 1000}s...`);
            await this.delay(delay);
          }
        }
      }

      throw lastError || new Error(`${model} failed after all retries`);
    };

    // === Single model-pair mode ===
    if (this.config.modelPair) {
      const { provider, primary, backup } = this.config.modelPair;
      const queryFn = (model: string) => {
        switch (provider) {
          case 'groq': return queryGroqRaw(prompt, model);
          case 'nvidia': return queryNvidiaRaw(prompt, model);
          case 'openai': return queryOpenAIRaw(prompt, model);
          case 'gemini': return queryGeminiRaw(prompt, model);
          case 'vertex-gemini': return queryVertexGeminiRaw(prompt, model);
          case 'vertex-claude': return queryVertexClaudeRaw(prompt, model);
          case 'vertex-grok': return queryVertexGrokRaw(prompt, model);
        }
      };

      let result: { text: string; model: string };
      try {
        result = await withRetry(() => queryFn(primary), primary);
      } catch {
        console.warn(`    ⚠ Primary model ${primary} failed, trying backup ${backup}...`);
        result = await withRetry(() => queryFn(backup), backup);
      }

      const scores = parseBatchIndustryResponse(result.text);
      if (scores.length > 0) {
        console.log(`    ✓ ${result.model}: ${scores.length} brands parsed`);
        return [{ model: result.model, scores }];
      }
      console.warn(`    ⚠️ Raw response from ${result.model} (unparseable):\n${result.text.slice(0, 500)}`);
      throw new Error(`${result.model} returned unparseable response`);
    }

    // === All-providers mode (existing behavior) ===
    const queries: Promise<{ model: string; text: string; error?: unknown }>[] = [];

    // Vertex Gemini
    if (this.apiKeys.vertexGemini) {
      queries.push(
        withRetry(() => queryVertexGeminiRaw(prompt), 'Vertex Gemini').catch(e => ({
          text: '', model: 'Vertex Gemini', error: e
        }))
      );
    }

    // Vertex Claude
    if (this.apiKeys.vertexClaude) {
      queries.push(
        withRetry(() => queryVertexClaudeRaw(prompt), 'Vertex Claude').catch(e => ({
          text: '', model: 'Vertex Claude', error: e
        }))
      );
    }

    // Vertex Grok
    if (this.apiKeys.vertexGrok) {
      queries.push(
        withRetry(() => queryVertexGrokRaw(prompt), 'Vertex Grok').catch(e => ({
          text: '', model: 'Vertex Grok', error: e
        }))
      );
    }

    // allSettled: each model resolves independently, no global timeout
    const settled = await Promise.allSettled(queries);
    const results = settled
      .filter((s): s is PromiseFulfilledResult<{ model: string; text: string; error?: unknown }> => s.status === 'fulfilled')
      .map(s => s.value);

    // Parse each model's batch response
    const parsed: { model: string; scores: BatchBrandScore[] }[] = [];
    for (const result of results) {
      if (result.error || !result.text) {
        console.warn(`    ⚠ ${result.model} failed: ${result.error instanceof Error ? result.error.message : 'unknown'}`);
        continue;
      }
      const scores = parseBatchIndustryResponse(result.text);
      if (scores.length > 0) {
        console.log(`    ✓ ${result.model}: ${scores.length} brands parsed`);
        parsed.push({ model: result.model, scores });
      } else {
        console.warn(`    ⚠️ Raw response from ${result.model} (unparseable):\n${result.text.slice(0, 500)}`);
        console.warn(`    ⚠ ${result.model}: could not parse response`);
      }
    }

    if (parsed.length === 0) {
      throw new Error("All AI providers failed for this industry");
    }

    return parsed;
  }

  private aggregateBatchResults(
    modelResults: { model: string; scores: BatchBrandScore[] }[],
    industry: Industry
  ): BrandAnalysisResult[] {
    // Build a map: brand name -> scores from each model
    const brandMap = new Map<string, { scores: BatchBrandScore[]; models: string[] }>();

    for (const { model, scores } of modelResults) {
      for (const score of scores) {
        // Fuzzy match brand name (case-insensitive, trim)
        const key = score.brand.trim().toLowerCase();
        if (!brandMap.has(key)) {
          brandMap.set(key, { scores: [], models: [] });
        }
        brandMap.get(key)!.scores.push(score);
        brandMap.get(key)!.models.push(model);
      }
    }

    // Create results for each brand in the industry
    return industry.topBrands.map(brandName => {
      const key = brandName.trim().toLowerCase();
      const data = brandMap.get(key);

      if (!data || data.scores.length === 0) {
        return {
          brand: brandName,
          industry: industry.id,
          category: industry.category,
          score: 0,
          breakdown: { recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 },
          responses: [],
          responseTime: 0,
          timestamp: new Date().toISOString(),
          error: 'No model returned data for this brand'
        };
      }

      // Average scores across models
      const count = data.scores.length;
      const avgBreakdown = {
        recommendation: Math.round(data.scores.reduce((s, d) => s + d.breakdown.recommendation, 0) / count),
        sentiment: Math.round(data.scores.reduce((s, d) => s + d.breakdown.sentiment, 0) / count),
        prominence: Math.round(data.scores.reduce((s, d) => s + d.breakdown.prominence, 0) / count),
        accuracy: Math.round(data.scores.reduce((s, d) => s + d.breakdown.accuracy, 0) / count),
      };
      const avgScore = avgBreakdown.recommendation + avgBreakdown.sentiment + avgBreakdown.prominence + avgBreakdown.accuracy;

      return {
        brand: brandName,
        industry: industry.id,
        category: industry.category,
        score: Math.min(100, avgScore),
        breakdown: avgBreakdown,
        responses: data.models.map(m => ({
          model: m,
          modelType: "free" as const,
          text: '',
          sentiment: "neutral" as const,
          mentionsCount: 0,
        })),
        responseTime: 0,
        timestamp: new Date().toISOString()
      };
    });
  }

  private calculateIndustryAverage(results: BrandAnalysisResult[]) {
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      return { score: 0, recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 };
    }

    const totals = validResults.reduce((acc, result) => ({
      score: acc.score + result.score,
      recommendation: acc.recommendation + result.breakdown.recommendation,
      sentiment: acc.sentiment + result.breakdown.sentiment,
      prominence: acc.prominence + result.breakdown.prominence,
      accuracy: acc.accuracy + result.breakdown.accuracy
    }), { score: 0, recommendation: 0, sentiment: 0, prominence: 0, accuracy: 0 });

    const count = validResults.length;
    return {
      score: Math.round(totals.score / count),
      recommendation: Math.round(totals.recommendation / count),
      sentiment: Math.round(totals.sentiment / count),
      prominence: Math.round(totals.prominence / count),
      accuracy: Math.round(totals.accuracy / count)
    };
  }

  private getTopPerformers(results: BrandAnalysisResult[], count: number): BrandAnalysisResult[] {
    return results
      .filter(r => !r.error)
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  private getBottomPerformers(results: BrandAnalysisResult[], count: number): BrandAnalysisResult[] {
    return results
      .filter(r => !r.error)
      .sort((a, b) => a.score - b.score)
      .slice(0, count);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
