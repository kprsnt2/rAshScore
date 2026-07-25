import { IndustryAnalysisResult } from './pipeline';

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'excel';
  includeDetails: boolean;
  includeCharts: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ReportData {
  title: string;
  generatedAt: string;
  summary: {
    totalIndustries: number;
    totalBrands: number;
    averageScore: number;
    completionRate: number;
  };
  industries: IndustryAnalysisResult[];
  insights: string[];
  recommendations: string[];
}

export class ReportExporter {
  static generateReportData(results: IndustryAnalysisResult[]): ReportData {
    const validResults = results.filter(r => !r.error);
    const allBrands = validResults.flatMap(r => r.brandResults.filter(b => !b.error));
    
    const summary = {
      totalIndustries: validResults.length,
      totalBrands: allBrands.length,
      averageScore: validResults.length > 0 
        ? Math.round(validResults.reduce((sum, r) => sum + r.industryAverage.score, 0) / validResults.length)
        : 0,
      completionRate: Math.round((validResults.length / results.length) * 100)
    };

    const insights = this.generateInsights(validResults);
    const recommendations = this.generateRecommendations(validResults);

    return {
      title: 'rAsh Score Analysis Report',
      generatedAt: new Date().toISOString(),
      summary,
      industries: validResults,
      insights,
      recommendations
    };
  }

  static exportToJSON(data: ReportData): string {
    return JSON.stringify(data, null, 2);
  }

  static exportToCSV(data: ReportData): string {
    const headers = [
      'Industry',
      'Brand',
      'Score',
      'Recommendation',
      'Sentiment',
      'Prominence',
      'Accuracy',
      'Rank in Industry'
    ];

    const rows = data.industries.flatMap(industry => 
      industry.brandResults
        .filter(brand => !brand.error)
        .sort((a, b) => b.score - a.score)
        .map((brand, index) => [
          industry.industry.name,
          brand.brand,
          brand.score,
          brand.breakdown.recommendation,
          brand.breakdown.sentiment,
          brand.breakdown.prominence,
          brand.breakdown.accuracy,
          index + 1
        ])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  static exportToHTML(data: ReportData): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #667eea;
            font-size: 2em;
        }
        .summary-card p {
            margin: 0;
            color: #666;
        }
        .industry-section {
            background: white;
            margin-bottom: 30px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .industry-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #dee2e6;
        }
        .industry-header h2 {
            margin: 0;
            color: #333;
        }
        .industry-score {
            float: right;
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        .score-high { color: #28a745; font-weight: bold; }
        .score-medium { color: #ffc107; font-weight: bold; }
        .score-low { color: #dc3545; font-weight: bold; }
        .insights-section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .insight-item {
            padding: 15px;
            margin-bottom: 10px;
            background: #e7f3ff;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }
        .recommendations {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
        @media print {
            body { background: white; }
            .summary-grid { grid-template-columns: repeat(4, 1fr); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${data.title}</h1>
        <p>Generated on ${new Date(data.generatedAt).toLocaleDateString()}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>${data.summary.totalIndustries}</h3>
            <p>Industries Analyzed</p>
        </div>
        <div class="summary-card">
            <h3>${data.summary.totalBrands}</h3>
            <p>Brands Covered</p>
        </div>
        <div class="summary-card">
            <h3>${data.summary.averageScore}</h3>
            <p>Average Score</p>
        </div>
        <div class="summary-card">
            <h3>${data.summary.completionRate}%</h3>
            <p>Completion Rate</p>
        </div>
    </div>

    <div class="insights-section">
        <h2>Key Insights</h2>
        ${data.insights.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
    </div>

    <div class="insights-section recommendations">
        <h2>Strategic Recommendations</h2>
        ${data.recommendations.map(rec => `<div class="insight-item">${rec}</div>`).join('')}
    </div>

    ${data.industries.map(industry => `
    <div class="industry-section">
        <div class="industry-header">
            <h2>${industry.industry.name}</h2>
            <div class="industry-score">${industry.industryAverage.score}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Brand</th>
                    <th>Score</th>
                    <th>Recommendation</th>
                    <th>Sentiment</th>
                    <th>Prominence</th>
                    <th>Accuracy</th>
                </tr>
            </thead>
            <tbody>
                ${industry.brandResults
                  .filter(brand => !brand.error)
                  .sort((a, b) => b.score - a.score)
                  .map((brand, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${brand.brand}</td>
                        <td class="${brand.score >= 80 ? 'score-high' : brand.score >= 60 ? 'score-medium' : 'score-low'}">${brand.score}</td>
                        <td>${brand.breakdown.recommendation}</td>
                        <td>${brand.breakdown.sentiment}</td>
                        <td>${brand.breakdown.prominence}</td>
                        <td>${brand.breakdown.accuracy}</td>
                    </tr>
                  `).join('')}
            </tbody>
        </table>
    </div>
    `).join('')}

    <div class="footer">
        <p>Report generated by rAsh Score Dashboard</p>
    </div>
</body>
</html>`;
    return html;
  }

  private static generateInsights(results: IndustryAnalysisResult[]): string[] {
    const insights: string[] = [];
    
    if (results.length === 0) return insights;

    const topIndustry = results.reduce((best, current) => 
      current.industryAverage.score > best.industryAverage.score ? current : best
    );

    insights.push(`🏆 ${topIndustry.industry.name} leads with the highest AI visibility score of ${topIndustry.industryAverage.score}`);

    const avgScore = results.reduce((sum, r) => sum + r.industryAverage.score, 0) / results.length;
    insights.push(`📊 Overall industry average score is ${Math.round(avgScore)}, indicating ${avgScore >= 60 ? 'strong' : 'moderate'} brand visibility`);

    const highPerformers = results.filter(r => r.industryAverage.score >= 80);
    insights.push(`🎯 ${highPerformers.length} industries achieved excellent scores (80+) in AI visibility`);

    const allBrands = results.flatMap(r => r.brandResults.filter(b => !b.error));
    const topBrands = allBrands.sort((a, b) => b.score - a.score).slice(0, 5);
    insights.push(`🌟 Top performing brands: ${topBrands.map(b => b.brand).join(', ')}`);

    return insights;
  }

  private static generateRecommendations(results: IndustryAnalysisResult[]): string[] {
    const recommendations: string[] = [];
    
    const lowPerformers = results.filter(r => r.industryAverage.score < 60);
    if (lowPerformers.length > 0) {
      recommendations.push(`📈 Focus on improving AI visibility in: ${lowPerformers.map(r => r.industry.name).join(', ')}`);
    }

    const lowSentiment = results.filter(r => r.industryAverage.sentiment < 20);
    if (lowSentiment.length > 0) {
      recommendations.push(`💬 Industries with low sentiment scores need content strategy improvements: ${lowSentiment.map(r => r.industry.name).join(', ')}`);
    }

    const lowProminence = results.filter(r => r.industryAverage.prominence < 12);
    if (lowProminence.length > 0) {
      recommendations.push(`🔍 Brands in ${lowProminence.map(r => r.industry.name).join(', ')} should increase online presence and visibility`);
    }

    recommendations.push('🔄 Regular monitoring and analysis of AI visibility trends is recommended for all industries');
    recommendations.push('📝 Consider implementing AI-optimized content strategies based on these insights');

    return recommendations;
  }

  static downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportReport(results: IndustryAnalysisResult[], options: ExportOptions): Promise<void> {
    const reportData = this.generateReportData(results);
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (options.format) {
      case 'json':
        const jsonContent = this.exportToJSON(reportData);
        this.downloadFile(jsonContent, `brand-intelligence-${timestamp}.json`, 'application/json');
        break;
        
      case 'csv':
        const csvContent = this.exportToCSV(reportData);
        this.downloadFile(csvContent, `brand-intelligence-${timestamp}.csv`, 'text/csv');
        break;
        
      case 'pdf':
        // For PDF, we'll create HTML and suggest printing to PDF
        const htmlContent = this.exportToHTML(reportData);
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
          setTimeout(() => {
            newWindow.print();
          }, 1000);
        }
        break;
        
      case 'excel':
        // For Excel, export CSV and suggest opening in Excel
        const excelContent = this.exportToCSV(reportData);
        this.downloadFile(excelContent, `brand-intelligence-${timestamp}.csv`, 'text/csv');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }
}
